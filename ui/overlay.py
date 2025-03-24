#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha Overlay Window
Transparent window that displays the Kovrycha companion.
"""

import os
import sys
import logging
import time
from threading import Thread
import traceback
from PyQt5.QtWidgets import (
    QWidget, QApplication, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QSystemTrayIcon, QMenu, QAction,
    QMainWindow, QDesktopWidget, QGraphicsDropShadowEffect
)
from PyQt5.QtCore import Qt, QTimer, QSize, QPoint, QRectF, QEvent, pyqtSignal
from PyQt5.QtGui import QPainter, QIcon, QPixmap, QColor, QFont, QCursor, QPen, QBrush

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import Kovrycha components
from core.brain import KovrychaBrain
from core.behavior import KovrychaBehavior
from core.sensory import KovrychaSensorySystem
from ui.debug_panel import KovrychDebugPanel
try:
    from utils.screen import ScreenAnalyzer
    HAS_SCREEN_ANALYZER = True
except ImportError:
    HAS_SCREEN_ANALYZER = False

logger = logging.getLogger('kovrycha.overlay')

class ScreenPositionManager:
    """Manages positioning of windows across multiple screens"""
    
    @staticmethod
    def get_screen_geometry(primary_only=True):
        """Get screen geometry, either primary only or all screens"""
        desktop = QDesktopWidget().screenGeometry()
        primary = QDesktopWidget().availableGeometry(QDesktopWidget().primaryScreen())
        
        if primary_only:
            return primary
        else:
            return desktop
    
    @staticmethod
    def update_window_position(window, primary_only=True):
        """Update window position based on screen configuration"""
        geometry = ScreenPositionManager.get_screen_geometry(primary_only)
        window.setGeometry(geometry)
    
    @staticmethod
    def center_on_screen(widget, primary_only=True):
        """Center a widget on screen"""
        geometry = ScreenPositionManager.get_screen_geometry(primary_only)
        widget.move(
            geometry.center().x() - widget.width() // 2,
            geometry.center().y() - widget.height() // 2
        )

class KovrychOverlay(QWidget):
    """Transparent overlay window for Kovrycha"""
    
    # Custom signals
    close_requested = pyqtSignal()
    
    def __init__(self, config):
        """Initialize overlay window"""
        super().__init__()
        self.config = config
        
        # Flags to track initialization
        self._is_initialized = False
        self._mouse_pressed = False
        self._drag_offset = None
        self._resize_events_enabled = False
        self._performance_stats = {
            'fps': 0,
            'last_frame_time': time.time(),
            'frame_count': 0,
            'last_fps_update': time.time()
        }
        
        try:
            # Create core components in the correct order
            self.setup_core_components()
            
            # Set up window after components are created
            self.setup_window()
            
            # Connect signals and start the update cycle
            self.connect_signals()
            
            # Create and position debug panel if needed
            self.setup_debug_panel()
            
            # Now enable resize events
            self._resize_events_enabled = True
            self._is_initialized = True
            
            logger.info("Overlay window initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing overlay: {e}")
            logger.error(traceback.format_exc())
            # Try to show a message before exiting
            try:
                from PyQt5.QtWidgets import QMessageBox
                QMessageBox.critical(None, "Kovrycha Initialization Error", 
                                    f"Failed to initialize: {str(e)}\n\nCheck logs for details.")
            except:
                pass
            sys.exit(1)
    
    def setup_core_components(self):
        """Set up core components in proper order"""
        logger.debug("Setting up core components")
        
        # Create brain first
        self.brain = KovrychaBrain(self.config)
        
        # Get screen dimensions for behavior
        screen_rect = ScreenPositionManager.get_screen_geometry(
            self.config.get('primary_screen_only', True)
        )
        
        # Create behavior with initial screen dimensions
        self.behavior = KovrychaBehavior(
            self.brain, 
            self.config,
            screen_rect.width(), 
            screen_rect.height()
        )
        
        # Initialize sensory system
        self.sensory = KovrychaSensorySystem(self.brain, self.config)
        
        # Initialize advanced screen analyzer if enabled
        if self.config.get('enable_advanced_analysis', False) and HAS_SCREEN_ANALYZER:
            self.screen_analyzer = ScreenAnalyzer(self.config)
            # Connect analyzer signals if needed
        else:
            self.screen_analyzer = None
    
    def setup_window(self):
        """Setup window properties"""
        logger.debug("Setting up window properties")
        
        # Set window flags for transparent, always-on-top overlay
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        
        # Set name and object name for styling
        self.setObjectName("KovrychOverlay")
        self.setWindowTitle("Kovrycha")
        
        # Set window to be transparent
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_NoSystemBackground)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)  # Enable mouse events
        
        # Set window size based on screen configuration
        screen_rect = ScreenPositionManager.get_screen_geometry(
            self.config.get('primary_screen_only', True)
        )
        self.setGeometry(screen_rect)
        
        # Handle window activation and focus
        self.setFocusPolicy(Qt.NoFocus)
        
        # Show window unless configured to start minimized
        if not self.config.get('start_minimized', False):
            self.show()
        
        # Install event filter for additional event handling
        self.installEventFilter(self)
        
        logger.debug(f"Window set up with size: {self.width()}x{self.height()}")
    
    def connect_signals(self):
        """Connect signals between components"""
        logger.debug("Connecting component signals")
        
        # Connect behavior signals
        self.behavior.redraw_requested.connect(self.update)
        
        # Connect sensory signals
        self.sensory.data_updated.connect(self.on_sensory_data)
        
        # Start update timer with configurable FPS
        self.fps = self.config.get('fps_limit', 60)
        self.frame_interval = 1000 // self.fps  # in milliseconds
        
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.on_update_timer)
        self.update_timer.start(self.frame_interval)
        
        # Performance monitoring timer
        if self.config.get('debug_mode', False):
            self.perf_timer = QTimer(self)
            self.perf_timer.timeout.connect(self.update_performance_stats)
            self.perf_timer.start(1000)  # Update stats every second
    
    def setup_debug_panel(self):
        """Create and position debug panel if debug mode enabled"""
        self.debug_panel = None
        if self.config.get('debug_mode', False):
            self.show_debug_panel()
    
    def toggle_debug_mode(self):
        """Toggle debug mode"""
        debug_mode = self.brain.toggle_debug_mode()
        if debug_mode:
            self.show_debug_panel()
        else:
            self.hide_debug_panel()
        
        # Update performance monitoring
        if debug_mode and not hasattr(self, 'perf_timer'):
            self.perf_timer = QTimer(self)
            self.perf_timer.timeout.connect(self.update_performance_stats)
            self.perf_timer.start(1000)
        elif hasattr(self, 'perf_timer') and not debug_mode:
            self.perf_timer.stop()
        
        # Repaint
        self.update()
    
    def toggle_primary_screen(self, checked):
        """Toggle primary screen only mode"""
        self.config['primary_screen_only'] = checked
        logger.info(f"Primary screen only set to {checked}")
        
        # Update window geometry
        ScreenPositionManager.update_window_position(self, checked)
        
        # Update behavior canvas size
        self.behavior.resize_canvas(self.width(), self.height())
    
    def show_debug_panel(self):
        """Show debug panel"""
        if not self.debug_panel:
            try:
                self.debug_panel = KovrychDebugPanel(self.brain, self.config)
                # Share sensory and behavior references for richer debugging
                if hasattr(self.debug_panel, 'set_components'):
                    self.debug_panel.set_components(self.sensory, self.behavior)
            except Exception as e:
                logger.error(f"Error creating debug panel: {e}")
                return
        
        # Position panel relative to primary monitor
        self.debug_panel.show()
        
        # Position at top right of primary monitor
        screen = QDesktopWidget().availableGeometry(QDesktopWidget().primaryScreen())
        self.debug_panel.move(
            screen.right() - self.debug_panel.width() - 20,
            screen.top() + 40
        )
    
    def hide_debug_panel(self):
        """Hide debug panel"""
        if self.debug_panel:
            self.debug_panel.hide()
    
    def set_mood(self, mood):
        """Set mood from tray menu"""
        if mood in self.config['mood_properties']:
            self.brain.mood = mood
            logger.info(f"Mood set to {mood} via tray menu")
    
    def reset_position(self):
        """Reset Kovrycha position to center of screen"""
        screen_rect = ScreenPositionManager.get_screen_geometry(
            self.config.get('primary_screen_only', True)
        )
        self.behavior.set_position(
            screen_rect.width() / 2,
            screen_rect.height() / 2
        )
        logger.info("Position reset to screen center")
    
    def exit_application(self):
        """Exit the application"""
        # Emit close signal to allow for cleanup
        self.close_requested.emit()
        
        # Stop timers and sensors
        self.update_timer.stop()
        if hasattr(self, 'perf_timer'):
            self.perf_timer.stop()
            
        self.sensory.stop_sensors()
        
        # Close debug panel if open
        if self.debug_panel:
            self.debug_panel.close()
        
        # Hide tray icon if exists
        if hasattr(self, 'tray_icon'):
            self.tray_icon.hide()
        
        # Close main window
        self.close()
        
        # Quit application
        QApplication.quit()
    
    def update_performance_stats(self):
        """Update performance statistics"""
        current_time = time.time()
        elapsed = current_time - self._performance_stats['last_fps_update']
        
        if elapsed > 0:
            self._performance_stats['fps'] = self._performance_stats['frame_count'] / elapsed
            self._performance_stats['frame_count'] = 0
            self._performance_stats['last_fps_update'] = current_time
            
            # Log performance if debug enabled
            if self.config.get('debug_mode', False) and self.debug_panel and hasattr(self.debug_panel, 'update_performance_stats'):
                self.debug_panel.update_performance_stats(self._performance_stats)
    
    def on_update_timer(self):
        """Timer update event"""
        # Update frame count for FPS calculation
        self._performance_stats['frame_count'] += 1
        self._performance_stats['last_frame_time'] = time.time()
    
    def on_sensory_data(self, data):
        """Handle sensory data updates"""
        # Update brain state
        self.brain.update_mood(data)
        
        # Update behavior
        self.behavior.update(data)
        
        # Update debug panel if visible
        if self.debug_panel and self.debug_panel.isVisible():
            self.debug_panel.update_info(data)
    
    def paintEvent(self, event):
        """Paint the overlay window"""
        # Skip if not fully initialized
        if not self._is_initialized:
            return
            
        # Create painter
        painter = QPainter(self)
        
        try:
            # Set rendering hints for smoother graphics
            painter.setRenderHint(QPainter.Antialiasing, True)
            painter.setRenderHint(QPainter.SmoothPixmapTransform, True)
            painter.setRenderHint(QPainter.TextAntialiasing, True)
            
            # Clear the background (transparent)
            painter.fillRect(event.rect(), QColor(0, 0, 0, 0))
            
            # Render Kovrycha
            self.behavior.render(painter)
            
            # Draw FPS if debug mode enabled
            if self.config.get('debug_mode', False):
                self.paint_debug_info(painter)
                
        except Exception as e:
            logger.error(f"Error in paint event: {e}")
        finally:
            # Always end painting properly
            painter.end()
    
    def paint_debug_info(self, painter):
        """Paint debug information overlay"""
        # Save painter state
        painter.save()
        
        # Set up text rendering
        font = QFont("Arial", 8)
        painter.setFont(font)
        painter.setPen(QColor(0, 0, 0, 180))
        
        # Draw FPS in bottom left corner
        fps_text = f"FPS: {self._performance_stats['fps']:.1f}"
        painter.drawText(10, self.height() - 10, fps_text)
        
        # Draw current mood
        mood_text = f"Mood: {self.brain.mood}"
        painter.drawText(10, self.height() - 25, mood_text)
        
        # Restore painter state
        painter.restore()
    
    def resizeEvent(self, event):
        """Handle window resize events"""
        # Skip resize events during initialization
        if not self._resize_events_enabled:
            return
            
        # Update behavior about new canvas size
        if hasattr(self, 'behavior'):
            self.behavior.resize_canvas(self.width(), self.height())
            
        super().resizeEvent(event)
    
    def mousePressEvent(self, event):
        """Handle mouse press events"""
        if event.button() == Qt.LeftButton:
            # Check if click is on Kovrycha
            pos = self.behavior.get_position()
            radius = self.behavior.radius
            dx = event.x() - pos[0]
            dy = event.y() - pos[1]
            
            if dx*dx + dy*dy <= radius*radius:
                # Click is on Kovrycha, start drag
                self._mouse_pressed = True
                self._drag_offset = (dx, dy)
                
                # Set cursor to hand
                self.setCursor(Qt.ClosedHandCursor)
                
                event.accept()
            else:
                # Click is outside Kovrycha, ignore
                event.ignore()
        elif event.button() == Qt.RightButton:
            # Check if click is on Kovrycha for context menu
            pos = self.behavior.get_position()
            radius = self.behavior.radius
            dx = event.x() - pos[0]
            dy = event.y() - pos[1]
            
            if dx*dx + dy*dy <= radius*radius:
                # Click is on Kovrycha, show context menu
                if hasattr(self, 'tray_icon'):
                    self.tray_icon.contextMenu().popup(QCursor.pos())
                event.accept()
            else:
                event.ignore()
        else:
            super().mousePressEvent(event)
    
    def mouseMoveEvent(self, event):
        """Handle mouse move events"""
        if self._mouse_pressed and self._drag_offset:
            # Move Kovrycha
            new_x = event.x() - self._drag_offset[0]
            new_y = event.y() - self._drag_offset[1]
            self.behavior.set_position(new_x, new_y)
            self.update()
            event.accept()
        else:
            # Hovering over Kovrycha - show hand cursor
            pos = self.behavior.get_position()
            radius = self.behavior.radius
            dx = event.x() - pos[0]
            dy = event.y() - pos[1]
            
            if dx*dx + dy*dy <= radius*radius:
                self.setCursor(Qt.OpenHandCursor)
            else:
                self.setCursor(Qt.ArrowCursor)
                
            super().mouseMoveEvent(event)
    
    def mouseReleaseEvent(self, event):
        """Handle mouse release events"""
        if event.button() == Qt.LeftButton and self._mouse_pressed:
            self._mouse_pressed = False
            self._drag_offset = None
            
            # Reset cursor
            self.setCursor(Qt.ArrowCursor)
            
            event.accept()
        else:
            super().mouseReleaseEvent(event)
    
    def mouseDoubleClickEvent(self, event):
        """Handle mouse double click events"""
        if event.button() == Qt.LeftButton:
            # Check if click is on Kovrycha
            pos = self.behavior.get_position()
            radius = self.behavior.radius
            dx = event.x() - pos[0]
            dy = event.y() - pos[1]
            
            if dx*dx + dy*dy <= radius*radius:
                # Double click on Kovrycha - toggle debug panel
                self.toggle_debug_mode()
                event.accept()
            else:
                event.ignore()
        else:
            super().mouseDoubleClickEvent(event)
    
    def wheelEvent(self, event):
        """Handle mouse wheel events"""
        # Check if wheel is over Kovrycha
        pos = self.behavior.get_position()
        radius = self.behavior.radius
        dx = event.x() - pos[0]
        dy = event.y() - pos[1]
        
        if dx*dx + dy*dy <= radius*radius:
            # Wheel over Kovrycha - adjust energy level
            delta = event.angleDelta().y()
            
            # Calculate energy adjustment (15 degrees = 0.1 energy)
            adjustment = (delta / 120) * 0.1
            
            # Update energy level
            new_energy = max(0.1, min(1.0, self.brain.energy + adjustment))
            self.brain.energy = new_energy
            
            # Log energy change
            logger.debug(f"Energy level adjusted to {new_energy:.2f} via mouse wheel")
            
            # Update immediately
            self.update()
            
            event.accept()
        else:
            super().wheelEvent(event)
    
    def eventFilter(self, obj, event):
        """Filter events for additional processing"""
        # Window events
        if obj == self and event.type() == QEvent.WindowActivate:
            # Window gained focus
            pass
        elif obj == self and event.type() == QEvent.WindowDeactivate:
            # Window lost focus
            pass
        
        # Process all other events normally
        return super().eventFilter(obj, event)
    
    def closeEvent(self, event):
        """Handle window close event"""
        # Check if we're really closing
        if event.spontaneous():
            # If user tried to close the window directly (e.g. Alt+F4),
            # minimize to tray instead unless explicitly exiting
            self.hide()
            event.ignore()
        else:
            # This is a programmatic close, accept it
            event.accept()


if __name__ == "__main__":
    # This is for testing only
    app = QApplication(sys.argv)
    
    # Set application attributes for high DPI
    app.setAttribute(Qt.AA_EnableHighDpiScaling)
    app.setAttribute(Qt.AA_UseHighDpiPixmaps)
    
    config = {
        'debug_mode': True,
        'primary_screen_only': True,
        'initial_mood': 'curious',
        'mood_colors': {
            'excited': ['#FFEA00', '#FF5722', '#FF9800'],
            'curious': ['#03A9F4', '#4CAF50', '#00BCD4'],
            'calm': ['#3F51B5', '#9C27B0', '#00BCD4'],
            'sleepy': ['#5C6BC0', '#7986CB', '#9FA8DA'],
            'alert': ['#F44336', '#FFFFFF', '#F44336'],
            'annoyed': ['#F44336', '#FFEB3B', '#F44336'],
            'sad': ['#1A237E', '#303F9F', '#3949AB'],
            'reflective': ['#9E9E9E', '#BDBDBD', '#E0E0E0']
        },
        'mood_properties': {
            'excited': {'pulse_speed': 0.03, 'move_speed': 2.5},
            'curious': {'pulse_speed': 0.015, 'move_speed': 1.8},
            'calm': {'pulse_speed': 0.008, 'move_speed': 0.7},
            'sleepy': {'pulse_speed': 0.004, 'move_speed': 0.3},
            'alert': {'pulse_speed': 0.05, 'move_speed': 3.0},
            'annoyed': {'pulse_speed': 0.04, 'move_speed': 2.0},
            'sad': {'pulse_speed': 0.005, 'move_speed': 0.5},
            'reflective': {'pulse_speed': 0.01, 'move_speed': 1.0}
        },
        'zones': {
            'active': {'width': 100, 'height': 100},
            'productivity': {'width': 300, 'height': 200},
            'notification': {'width': 200, 'height': 100},
            'media': {'width': 400, 'height': 300}
        }
    }
    window = KovrychOverlay(config)
    sys.exit(app.exec_())