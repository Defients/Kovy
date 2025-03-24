#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Screen Capture and Analysis Utilities
Advanced screen analysis for Kovrycha's environmental awareness.
"""

import logging
import numpy as np
import cv2
import mss
import mss.tools
import win32gui
import win32con
import win32api
from threading import Lock
from PyQt5.QtCore import QObject, pyqtSignal

logger = logging.getLogger('kovrycha.screen')

class ScreenAnalyzer(QObject):
    """Screen analysis utilities for advanced environment detection"""
    
    # Signal emitted when analysis results are ready
    analysis_ready = pyqtSignal(dict)
    
    def __init__(self, config):
        """Initialize screen analyzer"""
        super().__init__()
        self.config = config
        self.sct = mss.mss()
        
        # Screen capture settings
        self.primary_monitor = self.sct.monitors[1]  # Index 1 is usually the primary monitor
        self.capture_scale = 0.2  # Capture at 20% resolution for performance
        self.capture_interval = 0.1  # 100ms default interval
        
        # Lock for synchronizing access to shared data
        self.lock = Lock()
        
        # Analysis state
        self.last_frame = None
        self.current_frame = None
        self.diff_magnitude = 0
        self.motion_vectors = None
        self.active_regions = []
        self.dominant_colors = []
        
        # Window tracking
        self.window_list = []
        self.active_window_info = {
            'handle': None,
            'title': '',
            'rect': (0, 0, 0, 0),
            'is_fullscreen': False
        }
        
        # Historical data for analysis
        self.frame_history = []
        self.max_history_frames = 10
        
        logger.info("Screen analyzer initialized")
    
    def capture_screen(self, monitor=None):
        """Capture screen content at reduced resolution for analysis"""
        try:
            # Use specified monitor or default to primary
            if monitor is None:
                monitor = self.primary_monitor
            
            # Capture screenshot
            sct_img = self.sct.grab(monitor)
            
            # Convert to numpy array and resize for analysis
            img = np.array(sct_img)
            
            # Resize for performance
            width = int(monitor['width'] * self.capture_scale)
            height = int(monitor['height'] * self.capture_scale)
            img = cv2.resize(img, (width, height))
            
            # Convert to different color spaces for analysis
            gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
            hsv = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            hsv = cv2.cvtColor(hsv, cv2.COLOR_BGR2HSV)
            
            with self.lock:
                # Store current frame and move previous to history
                if self.current_frame is not None:
                    self.last_frame = self.current_frame
                    
                    # Add to history if we're keeping frame history
                    if self.max_history_frames > 0:
                        self.frame_history.append(self.last_frame)
                        # Keep history size limited
                        if len(self.frame_history) > self.max_history_frames:
                            self.frame_history.pop(0)
                
                self.current_frame = {
                    'color': img,
                    'gray': gray,
                    'hsv': hsv,
                    'monitor': monitor,
                    'timestamp': win32api.GetTickCount()
                }
            
            return True
        except Exception as e:
            logger.error(f"Error capturing screen: {e}")
            return False
    
    def analyze_changes(self):
        """Analyze changes between frames to detect visual activity"""
        with self.lock:
            if self.last_frame is None or self.current_frame is None:
                return {}
            
            try:
                # Calculate absolute difference between frames
                diff = cv2.absdiff(self.current_frame['gray'], self.last_frame['gray'])
                
                # Apply threshold to highlight significant changes
                _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                
                # Calculate percentage of changed pixels
                change_percent = np.count_nonzero(thresh) / thresh.size
                
                # Find contours of changed regions
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Analyze significant contours
                significant_regions = []
                for contour in contours:
                    area = cv2.contourArea(contour)
                    if area > 10:  # Minimum area to be considered significant
                        x, y, w, h = cv2.boundingRect(contour)
                        significant_regions.append({
                            'x': x / self.capture_scale,
                            'y': y / self.capture_scale,
                            'width': w / self.capture_scale,
                            'height': h / self.capture_scale,
                            'area': area / self.capture_scale**2
                        })
                
                # Calculate optical flow for motion detection if enabled
                if self.config.get('enable_motion_detection', False):
                    prev_gray = self.last_frame['gray']
                    curr_gray = self.current_frame['gray']
                    
                    # Calculate dense optical flow using Farneback method
                    flow = cv2.calcOpticalFlowFarneback(
                        prev_gray, curr_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
                    )
                    
                    # Calculate magnitude and angle
                    magnitude, angle = cv2.cartToPolar(flow[..., 0], flow[..., 1])
                    self.motion_vectors = {
                        'magnitude': magnitude,
                        'angle': angle,
                        'average_magnitude': np.mean(magnitude)
                    }
                
                # Store analysis results
                self.diff_magnitude = change_percent
                self.active_regions = significant_regions
                
                # Prepare results to emit
                results = {
                    'change_percent': change_percent,
                    'active_regions': significant_regions,
                    'timestamp': win32api.GetTickCount()
                }
                
                if hasattr(self, 'motion_vectors') and self.motion_vectors:
                    results['motion'] = {
                        'average_magnitude': self.motion_vectors['average_magnitude']
                    }
                
                return results
            
            except Exception as e:
                logger.error(f"Error analyzing frame changes: {e}")
                return {}
    
    def detect_dominant_colors(self, max_colors=5):
        """Detect dominant colors in the current frame"""
        with self.lock:
            if self.current_frame is None:
                return []
            
            try:
                # Convert image to RGB
                img = cv2.cvtColor(self.current_frame['color'], cv2.COLOR_BGRA2BGR)
                
                # Reshape image to be a list of pixels
                pixels = img.reshape((-1, 3))
                
                # Convert to float32
                pixels = np.float32(pixels)
                
                # Define criteria and apply kmeans()
                criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
                _, labels, centers = cv2.kmeans(pixels, max_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
                
                # Convert back to uint8
                centers = np.uint8(centers)
                
                # Count pixel frequency for each cluster
                unique_labels, counts = np.unique(labels, return_counts=True)
                
                # Get color percentages
                color_percentages = counts / counts.sum()
                
                # Sort colors by frequency
                sorted_indices = np.argsort(color_percentages)[::-1]
                sorted_centers = centers[sorted_indices]
                sorted_percentages = color_percentages[sorted_indices]
                
                # Store dominant colors with percentages
                self.dominant_colors = [
                    {
                        'rgb': (int(sorted_centers[i][2]), int(sorted_centers[i][1]), int(sorted_centers[i][0])),
                        'percentage': float(sorted_percentages[i])
                    }
                    for i in range(min(max_colors, len(sorted_centers)))
                ]
                
                return self.dominant_colors
            
            except Exception as e:
                logger.error(f"Error detecting dominant colors: {e}")
                return []
    
    def enumerate_windows(self):
        """Enumerate and analyze visible windows"""
        try:
            self.window_list = []
            
            def enum_windows_callback(hwnd, results):
                if win32gui.IsWindowVisible(hwnd):
                    rect = win32gui.GetWindowRect(hwnd)
                    width = rect[2] - rect[0]
                    height = rect[3] - rect[1]
                    
                    # Skip tiny windows and windows with zero dimensions
                    if width > 50 and height > 50:
                        title = win32gui.GetWindowText(hwnd)
                        
                        # Skip windows with empty titles
                        if title:
                            # Check if window is maximized/fullscreen
                            placement = win32gui.GetWindowPlacement(hwnd)
                            is_maximized = placement[1] == win32con.SW_SHOWMAXIMIZED
                            
                            self.window_list.append({
                                'handle': hwnd,
                                'title': title,
                                'rect': rect,
                                'width': width,
                                'height': height,
                                'is_maximized': is_maximized,
                                'is_active': (hwnd == win32gui.GetForegroundWindow())
                            })
            
            win32gui.EnumWindows(enum_windows_callback, [])
            return self.window_list
        
        except Exception as e:
            logger.error(f"Error enumerating windows: {e}")
            return []
    
    def get_active_window_info(self):
        """Get information about the currently active window"""
        try:
            hwnd = win32gui.GetForegroundWindow()
            
            # Check if we have this window in our list
            for window in self.window_list:
                if window['handle'] == hwnd:
                    self.active_window_info = window
                    return window
            
            # If not found, get info directly
            if hwnd:
                rect = win32gui.GetWindowRect(hwnd)
                title = win32gui.GetWindowText(hwnd)
                width = rect[2] - rect[0]
                height = rect[3] - rect[1]
                
                # Check if window is maximized/fullscreen
                placement = win32gui.GetWindowPlacement(hwnd)
                is_maximized = placement[1] == win32con.SW_SHOWMAXIMIZED
                
                self.active_window_info = {
                    'handle': hwnd,
                    'title': title,
                    'rect': rect,
                    'width': width,
                    'height': height,
                    'is_maximized': is_maximized,
                    'is_active': True
                }
                
                return self.active_window_info
            
            return None
        
        except Exception as e:
            logger.error(f"Error getting active window info: {e}")
            return None
    
    def analyze_screen_regions(self, regions):
        """Analyze specific regions of the screen"""
        with self.lock:
            if self.current_frame is None:
                return {}
            
            results = {}
            try:
                for name, region in regions.items():
                    # Convert region coordinates to current scale
                    scaled_x = int(region['x'] * self.capture_scale)
                    scaled_y = int(region['y'] * self.capture_scale)
                    scaled_width = int(region['width'] * self.capture_scale)
                    scaled_height = int(region['height'] * self.capture_scale)
                    
                    # Ensure region is within frame bounds
                    frame_height, frame_width = self.current_frame['gray'].shape
                    if (scaled_x < 0 or scaled_y < 0 or 
                        scaled_x + scaled_width > frame_width or 
                        scaled_y + scaled_height > frame_height):
                        continue
                    
                    # Extract region from current frame
                    region_img = self.current_frame['gray'][
                        scaled_y:scaled_y+scaled_height, 
                        scaled_x:scaled_x+scaled_width
                    ]
                    
                    # Calculate basic stats for region
                    region_stats = {
                        'mean': float(np.mean(region_img)),
                        'std': float(np.std(region_img)),
                        'min': float(np.min(region_img)),
                        'max': float(np.max(region_img))
                    }
                    
                    # Calculate change in region if we have a previous frame
                    if self.last_frame is not None:
                        # Extract region from previous frame
                        prev_region_img = self.last_frame['gray'][
                            scaled_y:scaled_y+scaled_height, 
                            scaled_x:scaled_x+scaled_width
                        ]
                        
                        # Calculate difference
                        diff = cv2.absdiff(region_img, prev_region_img)
                        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                        change_percent = np.count_nonzero(thresh) / thresh.size
                        
                        region_stats['change_percent'] = float(change_percent)
                    
                    results[name] = region_stats
                
                return results
            
            except Exception as e:
                logger.error(f"Error analyzing screen regions: {e}")
                return {}
    
    def detect_text_regions(self):
        """
        Detect potential text regions in the image
        Note: This is a simplified version. For actual OCR,
        consider using something like Tesseract or Windows OCR APIs.
        """
        with self.lock:
            if self.current_frame is None:
                return []
            
            try:
                # Convert to grayscale if not already
                gray = self.current_frame['gray']
                
                # Apply adaptive threshold
                thresh = cv2.adaptiveThreshold(
                    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                    cv2.THRESH_BINARY_INV, 11, 2
                )
                
                # Find contours
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Filter contours that might be text
                text_regions = []
                for contour in contours:
                    x, y, w, h = cv2.boundingRect(contour)
                    area = cv2.contourArea(contour)
                    
                    # Text typically has an aspect ratio (w/h) between 0.1 and 10
                    # and the area is not too small
                    aspect_ratio = w / h if h > 0 else 0
                    if 0.1 < aspect_ratio < 10 and 10 < area < 500:
                        text_regions.append({
                            'x': int(x / self.capture_scale),
                            'y': int(y / self.capture_scale),
                            'width': int(w / self.capture_scale),
                            'height': int(h / self.capture_scale),
                            'area': area
                        })
                
                # Group nearby regions that may form text lines
                text_regions = self.group_text_regions(text_regions)
                
                return text_regions
            
            except Exception as e:
                logger.error(f"Error detecting text regions: {e}")
                return []
    
    def group_text_regions(self, regions, max_y_distance=5):
        """Group text regions that may form lines of text"""
        if not regions:
            return []
        
        # Sort by Y coordinate
        regions.sort(key=lambda r: r['y'])
        
        # Group regions that have similar Y coordinates
        groups = []
        current_group = [regions[0]]
        current_y = regions[0]['y']
        
        for region in regions[1:]:
            if abs(region['y'] - current_y) <= max_y_distance:
                # Same line
                current_group.append(region)
            else:
                # New line
                if current_group:
                    groups.append(current_group)
                current_group = [region]
                current_y = region['y']
        
        # Add the last group
        if current_group:
            groups.append(current_group)
        
        # For each group, create a bounding box
        text_lines = []
        for group in groups:
            if len(group) > 1:  # Only consider groups with multiple regions
                min_x = min(r['x'] for r in group)
                min_y = min(r['y'] for r in group)
                max_x = max(r['x'] + r['width'] for r in group)
                max_y = max(r['y'] + r['height'] for r in group)
                
                text_lines.append({
                    'x': min_x,
                    'y': min_y,
                    'width': max_x - min_x,
                    'height': max_y - min_y,
                    'regions_count': len(group)
                })
        
        return text_lines
    
    def scan_regions_for_changes(self, regions):
        """Scan defined regions for significant changes over time"""
        results = {}
        
        with self.lock:
            if len(self.frame_history) < 2:
                return results
            
            try:
                current = self.current_frame['gray']
                
                # Calculate average change over recent frames
                change_history = {}
                
                for name, region in regions.items():
                    # Initialize history for this region
                    if name not in change_history:
                        change_history[name] = []
                    
                    # Convert region coordinates
                    scaled_x = int(region['x'] * self.capture_scale)
                    scaled_y = int(region['y'] * self.capture_scale)
                    scaled_width = int(region['width'] * self.capture_scale)
                    scaled_height = int(region['height'] * self.capture_scale)
                    
                    # Ensure region is within bounds
                    if scaled_x < 0 or scaled_y < 0:
                        continue
                        
                    frame_height, frame_width = current.shape
                    if (scaled_x + scaled_width > frame_width or 
                        scaled_y + scaled_height > frame_height):
                        continue
                    
                    # Extract current region
                    current_region = current[
                        scaled_y:scaled_y+scaled_height, 
                        scaled_x:scaled_x+scaled_width
                    ]
                    
                    # Calculate changes against each history frame
                    changes = []
                    for frame in self.frame_history:
                        history_frame = frame['gray']
                        
                        # Ensure history frame is the same size
                        if history_frame.shape != current.shape:
                            continue
                            
                        # Extract region from history frame
                        history_region = history_frame[
                            scaled_y:scaled_y+scaled_height, 
                            scaled_x:scaled_x+scaled_width
                        ]
                        
                        # Calculate difference
                        diff = cv2.absdiff(current_region, history_region)
                        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                        change_percent = np.count_nonzero(thresh) / thresh.size
                        
                        changes.append(change_percent)
                    
                    # Calculate average change
                    if changes:
                        avg_change = sum(changes) / len(changes)
                        
                        # Detect change patterns
                        is_increasing = all(changes[i] <= changes[i+1] for i in range(len(changes)-1))
                        is_decreasing = all(changes[i] >= changes[i+1] for i in range(len(changes)-1))
                        
                        change_type = 'stable'
                        if is_increasing:
                            change_type = 'increasing'
                        elif is_decreasing:
                            change_type = 'decreasing'
                        
                        results[name] = {
                            'average_change': avg_change,
                            'max_change': max(changes) if changes else 0,
                            'change_type': change_type
                        }
                
                return results
            
            except Exception as e:
                logger.error(f"Error scanning regions for changes: {e}")
                return {}
    
    def detect_animation(self, region, frames=5):
        """Detect if a region contains animation or video"""
        with self.lock:
            if len(self.frame_history) < frames:
                return {
                    'is_animated': False,
                    'confidence': 0,
                    'frames_analyzed': len(self.frame_history)
                }
            
            try:
                # Convert region coordinates
                scaled_x = int(region['x'] * self.capture_scale)
                scaled_y = int(region['y'] * self.capture_scale)
                scaled_width = int(region['width'] * self.capture_scale)
                scaled_height = int(region['height'] * self.capture_scale)
                
                # Collect region from each frame
                regions = []
                for frame in self.frame_history[-frames:]:
                    if scaled_x < 0 or scaled_y < 0:
                        continue
                        
                    frame_height, frame_width = frame['gray'].shape
                    if (scaled_x + scaled_width > frame_width or 
                        scaled_y + scaled_height > frame_height):
                        continue
                    
                    regions.append(
                        frame['gray'][
                            scaled_y:scaled_y+scaled_height, 
                            scaled_x:scaled_x+scaled_width
                        ]
                    )
                
                if len(regions) < 2:
                    return {
                        'is_animated': False,
                        'confidence': 0,
                        'frames_analyzed': len(regions)
                    }
                
                # Calculate frame-to-frame differences
                differences = []
                for i in range(len(regions) - 1):
                    diff = cv2.absdiff(regions[i], regions[i+1])
                    _, thresh = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)
                    change_percent = np.count_nonzero(thresh) / thresh.size
                    differences.append(change_percent)
                
                # Calculate average difference
                avg_diff = sum(differences) / len(differences)
                
                # Analyze consistency of changes
                is_consistent = np.std(differences) < 0.1 * avg_diff
                
                # Check if changes are significant and consistent (animation-like)
                is_animated = avg_diff > 0.01 and is_consistent
                
                # Calculate confidence
                confidence = min(1.0, avg_diff * 5) if is_animated else 0
                
                return {
                    'is_animated': is_animated,
                    'confidence': confidence,
                    'average_change': avg_diff,
                    'frames_analyzed': len(regions),
                    'is_consistent': is_consistent
                }
            
            except Exception as e:
                logger.error(f"Error detecting animation: {e}")
                return {
                    'is_animated': False,
                    'confidence': 0,
                    'error': str(e)
                }
    
    def perform_full_analysis(self):
        """Perform a comprehensive analysis of the screen"""
        # Capture current screen
        self.capture_screen()
        
        # Analyze changes
        change_results = self.analyze_changes()
        
        # Update window list
        self.enumerate_windows()
        
        # Get active window info
        active_window = self.get_active_window_info()
        
        # Analyze screen zones defined in config
        zone_results = {}
        if hasattr(self, 'brain') and hasattr(self.brain, 'zones'):
            zone_results = self.analyze_screen_regions(self.brain.zones)
        
        # Detect dominant colors
        colors = self.detect_dominant_colors()
        
        # Combine results
        results = {
            'timestamp': win32api.GetTickCount(),
            'changes': change_results,
            'active_window': active_window,
            'zones': zone_results,
            'colors': colors
        }
        
        # Emit results signal
        self.analysis_ready.emit(results)
        
        return results