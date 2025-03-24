#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha: AI-Infused Desktop Companion
An intelligent, persistent, AI-driven desktop companion that communicates through 
expressive color pulses, dynamic movements, and intelligent interactions.
"""

import sys
import os
import logging
import argparse
import traceback
import time
from pathlib import Path
from threading import Thread
import json

# Set PyQt version and configure environment variables
os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "1"

# Set Qt attributes BEFORE importing Qt modules
try:
    from PyQt5.QtCore import Qt, QCoreApplication, QSettings, QTimer, QSize
    from PyQt5.QtWidgets import (
        QApplication, QSplashScreen, QMessageBox, QProgressBar, 
        QSystemTrayIcon, QMenu, QAction, QDialog, QVBoxLayout, 
        QPushButton, QLabel, QCheckBox
    )
    from PyQt5.QtGui import QIcon, QPixmap, QFont, QFontDatabase
    
    # Set high DPI attributes before application is created
    QCoreApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QCoreApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    QCoreApplication.setOrganizationName("Kovrycha")
    QCoreApplication.setApplicationName("Kovrycha")
except ImportError as e:
    print(f"Error importing Qt libraries: {e}")
    print("Please make sure PyQt5 is installed: pip install PyQt5")
    sys.exit(1)


# Ensure project root is in path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)


def setup_logging(log_level=logging.INFO, log_file=None):
    """Configure application logging"""
    handlers = [logging.StreamHandler()]
    
    if log_file:
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        
        # Add file handler
        handlers.append(logging.FileHandler(log_file))
    
    # Configure logging
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )
    
    # Create logger
    logger = logging.getLogger('kovrycha')
    
    # Set third-party loggers to higher level to reduce noise
    logging.getLogger('PIL').setLevel(logging.WARNING)
    logging.getLogger('matplotlib').setLevel(logging.WARNING)
    
    return logger


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Kovrycha - AI Desktop Companion')
    
    # Basic arguments
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--config', type=str, help='Path to config file')
    parser.add_argument('--primary-only', action='store_true', help='Restrict to primary screen')
    
    # Advanced arguments
    parser.add_argument('--no-splash', action='store_true', help='Disable splash screen')
    parser.add_argument('--minimized', action='store_true', help='Start minimized to system tray')
    parser.add_argument('--log-file', type=str, help='Path to log file', default='logs/kovrycha.log')
    parser.add_argument('--log-level', type=str, choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                        default='INFO', help='Set logging level')
    parser.add_argument('--import-state', type=str, help='Import state from a saved file')
    
    return parser.parse_args()


class SplashScreen(QSplashScreen):
    """Enhanced splash screen with progress bar"""
    
    def __init__(self, pixmap=None):
        # Create default pixmap if none provided
        if pixmap is None:
            pixmap = QPixmap(400, 200)
            pixmap.fill(Qt.white)
        
        super().__init__(pixmap)
        
        # Add progress bar
        self.progress_bar = QProgressBar(self)
        self.progress_bar.setGeometry(10, pixmap.height() - 30, pixmap.width() - 20, 20)
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        
        # Add status label
        self.status_label = QLabel(self)
        self.status_label.setGeometry(10, pixmap.height() - 50, pixmap.width() - 20, 20)
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setText("Initializing...")
        
        # Set font
        font = QFont("Arial", 10)
        self.status_label.setFont(font)
    
    def update_progress(self, value, message):
        """Update progress bar and message"""
        self.progress_bar.setValue(value)
        self.status_label.setText(message)
        self.repaint()  # Force update


class FirstRunDialog(QDialog):
    """Dialog shown on first run"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.setWindowTitle("Welcome to Kovrycha")
        self.setMinimumWidth(500)
        
        layout = QVBoxLayout()
        
        # Welcome message
        welcome_label = QLabel(
            "<h2>Welcome to Kovrycha!</h2>"
            "<p>Your new AI desktop companion is ready to join your workspace.</p>"
            "<p>Kovrycha will respond to your activity by changing colors and movements.</p>"
        )
        welcome_label.setWordWrap(True)
        layout.addWidget(welcome_label)
        
        # Options
        self.start_with_windows = QCheckBox("Start Kovrycha when Windows starts")
        self.start_with_windows.setChecked(True)
        layout.addWidget(self.start_with_windows)
        
        self.start_minimized = QCheckBox("Start minimized to system tray")
        layout.addWidget(self.start_minimized)
        
        # Buttons
        self.start_button = QPushButton("Start Kovrycha")
        self.start_button.clicked.connect(self.accept)
        layout.addWidget(self.start_button)
        
        self.setLayout(layout)


def create_system_tray(overlay, config, show_action=None):
    """Create system tray icon and menu"""
    # Import here to avoid circular imports
    from ui.overlay import KovrychOverlay
    
    # Create tray icon
    tray_icon = QSystemTrayIcon(overlay)
    tray_icon.setToolTip('Kovrycha AI Companion')
    
    # Set icon
    icon_path = os.path.join(os.path.dirname(__file__), 'resources', 'icons', 'kovrycha.ico')
    if os.path.exists(icon_path):
        tray_icon.setIcon(QIcon(icon_path))
    else:
        # Create default icon
        pixmap = QPixmap(32, 32)
        pixmap.fill(Qt.blue)
        tray_icon.setIcon(QIcon(pixmap))
    
    # Create tray menu
    tray_menu = QMenu()
    
    # Add show/hide action if provided
    if show_action:
        tray_menu.addAction(show_action)
        tray_menu.addSeparator()
    
    # Add mood submenu
    mood_menu = QMenu('Set Mood')
    
    # Add mood actions
    for mood in config['mood_properties'].keys():
        mood_action = QAction(mood.capitalize(), overlay)
        mood_action.triggered.connect(lambda checked, m=mood: overlay.set_mood(m))
        mood_menu.addAction(mood_action)
    
    tray_menu.addMenu(mood_menu)
    tray_menu.addSeparator()
    
    # Debug mode toggle
    toggle_debug_action = QAction('Toggle Debug Mode', overlay)
    toggle_debug_action.triggered.connect(overlay.toggle_debug_mode)
    tray_menu.addAction(toggle_debug_action)
    
    # Screen mode
    toggle_primary_screen_action = QAction('Primary Screen Only', overlay)
    toggle_primary_screen_action.setCheckable(True)
    toggle_primary_screen_action.setChecked(config.get('primary_screen_only', True))
    toggle_primary_screen_action.triggered.connect(overlay.toggle_primary_screen)
    tray_menu.addAction(toggle_primary_screen_action)
    
    tray_menu.addSeparator()
    
    # Reset position action
    reset_action = QAction('Reset Position', overlay)
    reset_action.triggered.connect(lambda: overlay.reset_position())
    tray_menu.addAction(reset_action)
    
    # Save state action
    save_state_action = QAction('Save State', overlay)
    save_state_action.triggered.connect(lambda: save_application_state(overlay, config))
    tray_menu.addAction(save_state_action)
    
    tray_menu.addSeparator()
    
    # Exit action
    exit_action = QAction('Exit', overlay)
    exit_action.triggered.connect(overlay.exit_application)
    tray_menu.addAction(exit_action)
    
    # Set menu
    tray_icon.setContextMenu(tray_menu)
    
    # Show icon
    tray_icon.show()
    
    return tray_icon


def save_application_state(overlay, config):
    """Save current application state"""
    try:
        # Create state dictionary
        state = {
            'brain': overlay.brain.export_state() if hasattr(overlay, 'brain') else {},
            'behavior': {
                'position': overlay.behavior.get_position() if hasattr(overlay, 'behavior') else (0, 0)
            },
            'config': config,
            'timestamp': time.time()
        }
        
        # Save to file
        state_dir = os.path.join(os.path.dirname(__file__), 'states')
        os.makedirs(state_dir, exist_ok=True)
        
        filename = os.path.join(
            state_dir, 
            f"kovrycha_state_{time.strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        with open(filename, 'w') as f:
            json.dump(state, f, indent=2)
        
        logging.getLogger('kovrycha').info(f"Application state saved to {filename}")
        return True
    except Exception as e:
        logging.getLogger('kovrycha').error(f"Error saving application state: {e}")
        return False


def load_application_state(filename):
    """Load application state from file"""
    try:
        with open(filename, 'r') as f:
            state = json.load(f)
        
        logging.getLogger('kovrycha').info(f"Application state loaded from {filename}")
        return state
    except Exception as e:
        logging.getLogger('kovrycha').error(f"Error loading application state: {e}")
        return None


def add_startup_entry():
    """Add application to Windows startup"""
    try:
        import winreg
        
        # Get script path
        app_path = os.path.abspath(sys.argv[0])
        
        # If running from .py file, make sure to use pythonw
        if app_path.endswith('.py'):
            app_path = f'pythonw.exe "{app_path}" --minimized'
        
        # Open registry key
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE
        )
        
        # Set value
        winreg.SetValueEx(key, "Kovrycha", 0, winreg.REG_SZ, app_path)
        winreg.CloseKey(key)
        
        return True
    except Exception as e:
        logging.getLogger('kovrycha').error(f"Error adding startup entry: {e}")
        return False


def check_is_first_run():
    """Check if this is the first run of the application"""
    settings = QSettings()
    return not settings.contains("FirstRun")


def mark_first_run_complete():
    """Mark first run as complete"""
    settings = QSettings()
    settings.setValue("FirstRun", False)


def handle_first_run():
    """Handle first run actions"""
    # Show welcome dialog
    dialog = FirstRunDialog()
    if dialog.exec_() == QDialog.Accepted:
        # Set start with Windows
        if dialog.start_with_windows.isChecked():
            add_startup_entry()
        
        # Set start minimized
        start_minimized = dialog.start_minimized.isChecked()
        
        # Save settings
        settings = QSettings()
        settings.setValue("StartMinimized", start_minimized)
        
        # Mark first run complete
        mark_first_run_complete()
        
        return start_minimized
    
    return False


def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    """Handle uncaught exceptions"""
    # Log exception
    logger = logging.getLogger('kovrycha')
    logger.error("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))
    
    # Show error dialog
    error_message = f"{exc_type.__name__}: {exc_value}"
    stack_trace = ''.join(traceback.format_tb(exc_traceback))
    
    error_dialog = QMessageBox()
    error_dialog.setIcon(QMessageBox.Critical)
    error_dialog.setWindowTitle("Kovrycha Error")
    error_dialog.setText("An unexpected error occurred:")
    error_dialog.setInformativeText(error_message)
    error_dialog.setDetailedText(stack_trace)
    error_dialog.setStandardButtons(QMessageBox.Ok)
    error_dialog.exec_()


def main():
    """Main application entry point"""
    # Parse arguments
    args = parse_arguments()
    
    # Setup logging
    log_level = getattr(logging, args.log_level.upper())
    logger = setup_logging(log_level=log_level, log_file=args.log_file)
    logger.info("Starting Kovrycha")
    
    # Set exception handler
    sys.excepthook = handle_uncaught_exception
    
    # Create Qt application
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)  # Keep app running when windows are closed
    
    # Set application style
    app.setStyle("Fusion")
    
    # Show splash screen unless disabled
    splash = None
    if not args.no_splash:
        splash_image_path = os.path.join(script_dir, 'resources', 'images', 'splash.png')
        if os.path.exists(splash_image_path):
            splash = SplashScreen(QPixmap(splash_image_path))
        else:
            # Create default splash
            splash = SplashScreen()
        
        splash.show()
        app.processEvents()
    
    # Update splash if present
    if splash:
        splash.update_progress(10, "Loading configuration...")
    
    # Load configuration
    try:
        from utils.config import load_config, save_config
        
        # Determine config path
        config_path = args.config if args.config else os.path.join(script_dir, 'config.json')
        config = load_config(config_path)
        
        # Override config with command line arguments
        if args.debug:
            config['debug_mode'] = True
        if args.primary_only:
            config['primary_screen_only'] = True
        if args.minimized:
            config['start_minimized'] = True
        
        logger.info(f"Configuration loaded from {config_path}")
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        
        if splash:
            splash.hide()
        
        QMessageBox.critical(
            None,
            "Configuration Error",
            f"Failed to load configuration: {str(e)}\n\nCheck logs for details."
        )
        return 1
    
    # Update splash if present
    if splash:
        splash.update_progress(30, "Initializing components...")
    
    # Check for first run (only if not passed --import-state)
    start_minimized = config.get('start_minimized', False)
    if not args.import_state and check_is_first_run():
        if splash:
            splash.hide()
        
        start_minimized_from_dialog = handle_first_run()
        if start_minimized_from_dialog:
            start_minimized = True
    
    # Load saved state if specified
    import_state = None
    if args.import_state:
        # Update splash if present
        if splash:
            splash.update_progress(50, f"Loading saved state from {args.import_state}...")
        
        import_state = load_application_state(args.import_state)
        if import_state:
            # Update config from saved state
            saved_config = import_state.get('config', {})
            if saved_config:
                # Merge configs, keeping command line overrides
                for key, value in saved_config.items():
                    if key not in ['debug_mode', 'primary_screen_only', 'start_minimized']:
                        config[key] = value
    
    # Update splash if present
    if splash:
        splash.update_progress(70, "Creating overlay window...")
    
    try:
        # Import overlay module
        from ui.overlay import KovrychOverlay
        
        # Create overlay window
        overlay = KovrychOverlay(config)
        
        # Import saved state if available
        if import_state:
            # Import brain state
            if hasattr(overlay, 'brain') and 'brain' in import_state:
                overlay.brain.import_state(import_state['brain'])
            
            # Import behavior state
            if hasattr(overlay, 'behavior') and 'behavior' in import_state:
                behavior_state = import_state['behavior']
                if 'position' in behavior_state:
                    x, y = behavior_state['position']
                    overlay.behavior.set_position(x, y)
        
        # Create show/hide action
        show_action = QAction('Show/Hide Kovrycha', overlay)
        
        def toggle_visibility():
            if overlay.isVisible():
                overlay.hide()
                show_action.setText('Show Kovrycha')
            else:
                overlay.show()
                show_action.setText('Hide Kovrycha')
        
        show_action.triggered.connect(toggle_visibility)
        
        # Create system tray
        tray_icon = create_system_tray(overlay, config, show_action)
        
        # Connect tray icon activated signal
        def on_tray_activated(reason):
            if reason == QSystemTrayIcon.Trigger:
                toggle_visibility()
        
        tray_icon.activated.connect(on_tray_activated)
        
        # Store tray icon in overlay for later access
        overlay.tray_icon = tray_icon
        
        # Handle initial visibility
        if start_minimized:
            overlay.hide()
            show_action.setText('Show Kovrycha')
        else:
            overlay.show()
            show_action.setText('Hide Kovrycha')
        
        # Update splash to 100%
        if splash:
            splash.update_progress(100, "Kovrycha is ready!")
            QTimer.singleShot(1000, splash.close)  # Close after 1 second
    
    except Exception as e:
        logger.error(f"Error creating overlay: {e}")
        logger.error(traceback.format_exc())
        
        if splash:
            splash.hide()
        
        QMessageBox.critical(
            None,
            "Initialization Error",
            f"Failed to initialize Kovrycha: {str(e)}\n\nCheck logs for details."
        )
        return 1
    
    # Start application
    logger.info("Kovrycha initialized")
    
    try:
        exit_code = app.exec_()
    except Exception as e:
        logger.error(f"Error in main event loop: {e}")
        exit_code = 1
    
    # Save updated config on exit
    try:
        save_config(config, config_path)
        logger.info(f"Configuration saved to {config_path}")
    except Exception as e:
        logger.error(f"Error saving configuration: {e}")
    
    logger.info("Kovrycha shutdown")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())