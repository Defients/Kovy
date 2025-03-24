#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha Sensory System
Monitors screen activity, mouse movements, and system events.
"""

import time
import logging
import numpy as np
from threading import Thread, Lock
from PyQt5.QtCore import QObject, pyqtSignal, QTimer
import pyautogui
import mss
import mss.tools
import cv2
from pynput import mouse
import win32gui

logger = logging.getLogger('kovrycha.sensory')

class KovrychaSensorySystem(QObject):
    """Sensory system for monitoring desktop environment"""
    
    # Signal for when new sensory data is available
    data_updated = pyqtSignal(dict)
    
    def __init__(self, brain, config):
        """Initialize sensory system"""
        super().__init__()
        self.brain = brain
        self.config = config
        
        # Mouse tracking
        self.mouse_x = 0
        self.mouse_y = 0
        self.mouse_velocity_x = 0
        self.mouse_velocity_y = 0
        self.last_mouse_x = 0
        self.last_mouse_y = 0
        self.mouse_active = False
        self.mouse_activity_level = 0
        self.last_mouse_move_time = 0
        
        # Screen capture properties
        self.sct = mss.mss()
        self.screen_width, self.screen_height = pyautogui.size()
        self.primary_monitor = self.sct.monitors[1]  # Index 1 is the primary monitor
        
        # Setup active window tracking
        self.active_window = {
            'handle': None,
            'title': '',
            'x': 0,
            'y': 0,
            'width': 0,
            'height': 0,
            'is_active': True
        }
        
        # Visual change detection
        self.last_frame = None
        self.current_frame = None
        self.last_sampled_time = time.time()
        self.visual_change_level = 0
        self.frame_lock = Lock()
        
        # Sampling intervals
        self.mouse_sample_interval = 0.01  # 10ms
        self.screen_sample_interval = 0.1  # 100ms for screen changes (lower for production)
        self.window_sample_interval = 0.5  # 500ms for window info
        
        # Start background threads and timers
        self.running = True
        self.start_sensors()
        
        logger.info("Sensory system initialized")
    
    def start_sensors(self):
        """Start all sensor threads and timers"""
        # Start mouse listener
        self.mouse_listener = mouse.Listener(on_move=self.on_mouse_move, 
                                           on_click=self.on_mouse_click)
        self.mouse_listener.start()
        
        # Start screen sampling timer
        self.screen_timer = QTimer()
        self.screen_timer.timeout.connect(self.sample_screen)
        self.screen_timer.start(int(self.screen_sample_interval * 1000))
        
        # Start window info timer
        self.window_timer = QTimer()
        self.window_timer.timeout.connect(self.update_window_info)
        self.window_timer.start(int(self.window_sample_interval * 1000))
        
        # Start data emission timer
        self.data_timer = QTimer()
        self.data_timer.timeout.connect(self.emit_sensory_data)
        self.data_timer.start(int(self.mouse_sample_interval * 1000))
        
        # Initialize zones
        self.update_zones()
    
    def stop_sensors(self):
        """Stop all sensory threads and timers"""
        self.running = False
        
        # Stop mouse listener
        if hasattr(self, 'mouse_listener') and self.mouse_listener.is_alive():
            self.mouse_listener.stop()
        
        # Stop timers
        if hasattr(self, 'screen_timer'):
            self.screen_timer.stop()
        
        if hasattr(self, 'window_timer'):
            self.window_timer.stop()
        
        if hasattr(self, 'data_timer'):
            self.data_timer.stop()
    
    def on_mouse_move(self, x, y):
        """Mouse movement handler"""
        # Store previous position
        self.last_mouse_x = self.mouse_x
        self.last_mouse_y = self.mouse_y
        
        # Update current position
        self.mouse_x = x
        self.mouse_y = y
        
        # Calculate velocity
        self.mouse_velocity_x = self.mouse_x - self.last_mouse_x
        self.mouse_velocity_y = self.mouse_y - self.last_mouse_y
        
        # Update activity level
        speed = np.sqrt(
            self.mouse_velocity_x**2 + 
            self.mouse_velocity_y**2
        )
        
        # Normalize to 0-1 with configurable sensitivity
        sensitivity = self.config.get('mouse_activity_sensitivity', 1.0)
        self.mouse_activity_level = min(1.0, (speed / 30) * sensitivity)
        
        self.last_mouse_move_time = time.time()
        self.mouse_active = True
        
        # Update zones based on mouse position
        self.update_zones_from_mouse()
    
    def on_mouse_click(self, x, y, button, pressed):
        """Mouse click handler"""
        if pressed:
            # Simulate visual change on click
            self.visual_change_level = max(self.visual_change_level, 0.7)
            
            # Schedule decay of visual change
            QTimer.singleShot(500, self.decay_visual_change)
    
    def decay_visual_change(self):
        """Decay the visual change level over time"""
        self.visual_change_level *= 0.5
    
    def sample_screen(self):
        """Sample screen for visual changes"""
        try:
            # Determine which monitor to capture
            if self.config.get('primary_screen_only', True):
                monitor = self.primary_monitor
            else:
                # Find which monitor contains the mouse cursor
                for i, m in enumerate(self.sct.monitors[1:], 1):  # Skip the "all monitors" entry
                    if (m['left'] <= self.mouse_x < m['left'] + m['width'] and
                        m['top'] <= self.mouse_y < m['top'] + m['height']):
                        monitor = m
                        break
                else:
                    monitor = self.primary_monitor

            # Capture screen with reduced size for performance
            scale_factor = 0.2  # Capture at 20% resolution for performance
            width = int(monitor['width'] * scale_factor)
            height = int(monitor['height'] * scale_factor)
            
            # Capture screenshot
            sct_img = self.sct.grab(monitor)
            
            # Convert to numpy array and resize
            img = np.array(sct_img)
            img = cv2.resize(img, (width, height))
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)  # Convert to grayscale
            
            with self.frame_lock:
                # Store current frame
                self.last_frame = self.current_frame
                self.current_frame = img
                
                # Calculate visual change if we have two frames
                if self.last_frame is not None and self.current_frame is not None:
                    # Calculate absolute difference
                    diff = cv2.absdiff(self.last_frame, self.current_frame)
                    
                    # Threshold the difference
                    _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                    
                    # Calculate percentage of changed pixels
                    change_percent = np.count_nonzero(thresh) / (width * height)
                    
                    # Apply sensitivity multiplier
                    sensitivity = self.config.get('visual_change_sensitivity', 1.0)
                    self.visual_change_level = min(1.0, change_percent * 10 * sensitivity)
                    
                    # Analyze changes in specific zones
                    for zone_name, zone in self.brain.zones.items():
                        # Convert zone coordinates to screen capture coordinates
                        zone_x = int(zone['x'] * scale_factor)
                        zone_y = int(zone['y'] * scale_factor)
                        zone_w = int(zone['width'] * scale_factor)
                        zone_h = int(zone['height'] * scale_factor)
                        
                        # Ensure zone is within the captured image bounds
                        if (zone_x >= 0 and zone_y >= 0 and 
                            zone_x + zone_w <= width and zone_y + zone_h <= height):
                            
                            # Extract zone from diff image
                            zone_diff = thresh[zone_y:zone_y+zone_h, zone_x:zone_x+zone_w]
                            
                            # Calculate change percentage in this zone
                            if zone_diff.size > 0:
                                zone_change = np.count_nonzero(zone_diff) / zone_diff.size
                                logger.debug(f"Zone {zone_name} change: {zone_change:.4f}")
                
        except Exception as e:
            logger.error(f"Error sampling screen: {e}")
    
    def update_window_info(self):
        """Update information about the active window"""
        try:
            # Get active window handle
            hwnd = win32gui.GetForegroundWindow()
            
            if hwnd != self.active_window['handle']:
                # Window changed
                rect = win32gui.GetWindowRect(hwnd)
                title = win32gui.GetWindowText(hwnd)
                
                self.active_window = {
                    'handle': hwnd,
                    'title': title,
                    'x': rect[0],
                    'y': rect[1],
                    'width': rect[2] - rect[0],
                    'height': rect[3] - rect[1],
                    'is_active': True
                }
                
                # Trigger visual change since window changed
                self.visual_change_level = max(self.visual_change_level, 0.6)
                
                logger.debug(f"Active window changed to: {title}")
        except Exception as e:
            logger.error(f"Error updating window info: {e}")
    
    def update_zones(self):
        """Update activity zones based on screen size and active window"""
        try:
            width = self.screen_width
            height = self.screen_height
            
            # Active zone follows the mouse cursor
            self.update_zones_from_mouse()
            
            # Productivity zone - based on active window or screen center
            if self.active_window['width'] > 0:
                # Center on active window
                self.brain.zones['productivity'] = {
                    'x': self.active_window['x'] + self.active_window['width'] // 2 - 150,
                    'y': self.active_window['y'] + self.active_window['height'] // 2 - 100,
                    'width': 300,
                    'height': 200
                }
            else:
                # Center on screen
                self.brain.zones['productivity'] = {
                    'x': width // 2 - 150,
                    'y': height // 2 - 100,
                    'width': 300,
                    'height': 200
                }
            
            # Notification zone - top right corner
            self.brain.zones['notification'] = {
                'x': width - 210,
                'y': 10,
                'width': 200,
                'height': 100
            }
            
            # Media zone - bottom portion
            self.brain.zones['media'] = {
                'x': width // 2 - 200,
                'y': height - 310,
                'width': 400,
                'height': 300
            }
            
        except Exception as e:
            logger.error(f"Error updating zones: {e}")
    
    def update_zones_from_mouse(self):
        """Update active zone to follow mouse cursor"""
        size = self.config['zones']['active']['width']
        self.brain.zones['active'] = {
            'x': self.mouse_x - size // 2,
            'y': self.mouse_y - size // 2,
            'width': size,
            'height': size
        }
    
    def detect_active_zone(self):
        """Determine which zone the cursor is in"""
        for zone_name, zone in self.brain.zones.items():
            if self.is_point_in_zone(self.mouse_x, self.mouse_y, zone):
                return zone_name
        
        return 'background'
    
    def is_point_in_zone(self, x, y, zone):
        """Check if a point is inside a zone"""
        return (
            x >= zone['x'] and 
            x <= zone['x'] + zone['width'] and 
            y >= zone['y'] and 
            y <= zone['y'] + zone['height']
        )
    
    def simulate_visual_changes(self):
        """Natural decay of visual change over time"""
        current_time = time.time()
        time_since_last_sample = current_time - self.last_sampled_time
        
        # Natural decay of visual change
        self.visual_change_level = max(0, self.visual_change_level - (time_since_last_sample * 0.2))
        
        # Mouse activity decay
        if current_time - self.last_mouse_move_time > 500:  # 500ms
            self.mouse_activity_level = max(0, self.mouse_activity_level - (time_since_last_sample * 0.5))
            
            if self.mouse_activity_level < 0.05:
                self.mouse_active = False
        
        self.last_sampled_time = current_time
    
    def emit_sensory_data(self):
        """Emit current sensory data to listeners"""
        # Decay visual changes over time
        self.simulate_visual_changes()
        
        # Compile sensory data
        sensory_data = self.get_sensory_data()
        
        # Emit signal with data
        self.data_updated.emit(sensory_data)
    
    def get_sensory_data(self):
        """Get current sensory data"""
        # Update simulated visual detection
        self.simulate_visual_changes()
        
        # Determine which zone is active
        active_zone = self.detect_active_zone()
        
        # Compile sensory data
        return {
            'mouse_x': self.mouse_x,
            'mouse_y': self.mouse_y,
            'mouse_velocity_x': self.mouse_velocity_x,
            'mouse_velocity_y': self.mouse_velocity_y,
            'mouse_active': self.mouse_active,
            'mouse_activity': self.mouse_activity_level,
            'zone': active_zone,
            'visual_change': self.visual_change_level,
            'window_active': self.active_window['is_active'],
            'window_title': self.active_window['title'],
            'timestamp': time.time()
        }