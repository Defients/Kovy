#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha Debug Panel
Provides debugging information and controls for Kovrycha.
"""

import os
import sys
import json
import time
import logging
import traceback
from datetime import datetime
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QComboBox, QSlider, QGroupBox, QTabWidget, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView, QCheckBox,
    QSpinBox, QDoubleSpinBox, QFormLayout, QSplitter,
    QApplication, QScrollArea, QColorDialog, QDialog,
    QTreeWidget, QTreeWidgetItem, QProgressBar, QToolButton,
    QMenu, QAction, QFileDialog, QMessageBox, QFrame
)
from PyQt5.QtCore import (
    Qt, QTimer, QSize, pyqtSlot, QProcess, 
    QByteArray, QBuffer, QIODevice, QThread, pyqtSignal
)
from PyQt5.QtGui import (
    QFont, QColor, QPalette, QPixmap, QPainter, 
    QBrush, QPen, QIcon, QTextCursor, QTextCharFormat
)
from PyQt5.QtChart import QChart, QChartView, QLineSeries, QValueAxis

# Attempt to import optional dependencies
try:
    import numpy as np
    import matplotlib
    matplotlib.use('Qt5Agg')
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

logger = logging.getLogger('kovrycha.debug_panel')

class HistoryChart(QWidget):
    """Chart for displaying historical data"""
    
    def __init__(self, title="History Chart", parent=None):
        super().__init__(parent)
        self.setMinimumHeight(150)
        
        # Create layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create chart
        self.chart = QChart()
        self.chart.setTitle(title)
        self.chart.setTheme(QChart.ChartThemeLight)
        self.chart.setMargins(QByteArray())
        self.chart.setBackgroundRoundness(0)
        self.chart.legend().hide()
        
        # Create axes
        self.x_axis = QValueAxis()
        self.x_axis.setRange(0, 100)
        self.x_axis.setLabelFormat("%d")
        self.x_axis.setTickCount(5)
        self.x_axis.setMinorTickCount(1)
        self.chart.addAxis(self.x_axis, Qt.AlignBottom)
        
        self.y_axis = QValueAxis()
        self.y_axis.setRange(0, 1)
        self.y_axis.setLabelFormat("%.1f")
        self.y_axis.setTickCount(5)
        self.y_axis.setMinorTickCount(1)
        self.chart.addAxis(self.y_axis, Qt.AlignLeft)
        
        # Create chart view
        self.chart_view = QChartView(self.chart)
        self.chart_view.setRenderHint(QPainter.Antialiasing)
        layout.addWidget(self.chart_view)
        
        # Create series for each data type
        self.series = {}
        self.add_series("default", QColor(0, 120, 215))
        
        # Data storage
        self.data_history = {}
        self.max_data_points = 100
        self.point_count = 0
    
    def add_series(self, name, color):
        """Add a new data series to the chart"""
        series = QLineSeries()
        series.setName(name)
        series.setPen(QPen(color, 2))
        self.chart.addSeries(series)
        series.attachAxis(self.x_axis)
        series.attachAxis(self.y_axis)
        self.series[name] = series
        self.data_history[name] = []
    
    def add_data_point(self, name, value):
        """Add a new data point to the specified series"""
        if name not in self.series:
            return
            
        # Add data point
        self.data_history[name].append(value)
        
        # Keep history within limit
        if len(self.data_history[name]) > self.max_data_points:
            self.data_history[name].pop(0)
        
        # Update series
        series = self.series[name]
        series.clear()
        
        # Add all points to series
        for i, value in enumerate(self.data_history[name]):
            series.append(i, value)
        
        # Increment point count
        self.point_count += 1
        
        # Update x-axis range if needed
        if len(self.data_history[name]) >= self.max_data_points:
            self.x_axis.setRange(self.point_count - self.max_data_points, self.point_count)
        else:
            self.x_axis.setRange(0, max(10, len(self.data_history[name])))
        
        # Update y-axis range
        if self.data_history[name]:
            min_val = min(self.data_history[name])
            max_val = max(self.data_history[name])
            padding = max((max_val - min_val) * 0.1, 0.1)
            self.y_axis.setRange(max(0, min_val - padding), max_val + padding)
    
    def clear_data(self):
        """Clear all data from the chart"""
        for name in self.series:
            self.series[name].clear()
            self.data_history[name] = []
        self.point_count = 0
        self.x_axis.setRange(0, 10)
        self.y_axis.setRange(0, 1)

class ZoneInspector(QWidget):
    """Widget for inspecting and editing zones"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # Create layout
        self.layout = QVBoxLayout(self)
        
        # Create zone display
        self.zone_display = QWidget()
        self.zone_display.setMinimumHeight(200)
        self.zone_display.setStyleSheet("background-color: #f0f0f0; border: 1px solid #ccc;")
        self.layout.addWidget(self.zone_display)
        
        # Create zone editor
        form_layout = QFormLayout()
        
        # Zone selector
        self.zone_selector = QComboBox()
        self.zone_selector.currentIndexChanged.connect(self.on_zone_selected)
        form_layout.addRow("Zone:", self.zone_selector)
        
        # Zone properties
        self.x_spinner = QSpinBox()
        self.x_spinner.setRange(0, 9999)
        self.x_spinner.valueChanged.connect(self.on_zone_property_changed)
        form_layout.addRow("X:", self.x_spinner)
        
        self.y_spinner = QSpinBox()
        self.y_spinner.setRange(0, 9999)
        self.y_spinner.valueChanged.connect(self.on_zone_property_changed)
        form_layout.addRow("Y:", self.y_spinner)
        
        self.width_spinner = QSpinBox()
        self.width_spinner.setRange(10, 9999)
        self.width_spinner.valueChanged.connect(self.on_zone_property_changed)
        form_layout.addRow("Width:", self.width_spinner)
        
        self.height_spinner = QSpinBox()
        self.height_spinner.setRange(10, 9999)
        self.height_spinner.valueChanged.connect(self.on_zone_property_changed)
        form_layout.addRow("Height:", self.height_spinner)
        
        self.layout.addLayout(form_layout)
        
        # Add reset button
        reset_button = QPushButton("Reset Zones")
        reset_button.clicked.connect(self.on_reset_zones)
        self.layout.addWidget(reset_button)
        
        # Store zones
        self.zones = {}
        self.current_zone = None
        self.brain = None
        
        # Update timer
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.update_display)
        self.update_timer.start(100)
    
    def set_brain(self, brain):
        """Set brain reference for zone access"""
        self.brain = brain
        self.update_zone_list()
    
    def update_zone_list(self):
        """Update zone selector with available zones"""
        if not self.brain or not hasattr(self.brain, 'zones'):
            return
            
        # Store current selection
        current_text = self.zone_selector.currentText()
        
        # Clear and repopulate
        self.zone_selector.clear()
        self.zones = self.brain.zones
        
        for zone_name in self.zones.keys():
            self.zone_selector.addItem(zone_name)
        
        # Restore selection if possible
        index = self.zone_selector.findText(current_text)
        if index >= 0:
            self.zone_selector.setCurrentIndex(index)
        elif self.zone_selector.count() > 0:
            self.zone_selector.setCurrentIndex(0)
    
    def on_zone_selected(self, index):
        """Handle zone selection change"""
        if index < 0 or not self.zones:
            self.current_zone = None
            return
            
        # Get selected zone name
        zone_name = self.zone_selector.currentText()
        if zone_name in self.zones:
            self.current_zone = zone_name
            zone = self.zones[zone_name]
            
            # Update spinners without triggering events
            self.x_spinner.blockSignals(True)
            self.y_spinner.blockSignals(True)
            self.width_spinner.blockSignals(True)
            self.height_spinner.blockSignals(True)
            
            self.x_spinner.setValue(zone['x'])
            self.y_spinner.setValue(zone['y'])
            self.width_spinner.setValue(zone['width'])
            self.height_spinner.setValue(zone['height'])
            
            self.x_spinner.blockSignals(False)
            self.y_spinner.blockSignals(False)
            self.width_spinner.blockSignals(False)
            self.height_spinner.blockSignals(False)
    
    def on_zone_property_changed(self):
        """Handle zone property changes"""
        if not self.current_zone or not self.brain:
            return
            
        # Update zone with spinner values
        self.brain.zones[self.current_zone] = {
            'x': self.x_spinner.value(),
            'y': self.y_spinner.value(),
            'width': self.width_spinner.value(),
            'height': self.height_spinner.value()
        }
    
    def on_reset_zones(self):
        """Reset zones to default positions"""
        if not self.brain:
            return
            
        # Reset zones based on screen size
        screen_width = self.zone_display.width()
        screen_height = self.zone_display.height()
        
        # Productivity zone - center
        self.brain.zones['productivity'] = {
            'x': screen_width // 2 - 150,
            'y': screen_height // 2 - 100,
            'width': 300,
            'height': 200
        }
        
        # Notification zone - top right
        self.brain.zones['notification'] = {
            'x': screen_width - 210,
            'y': 10,
            'width': 200,
            'height': 100
        }
        
        # Media zone - bottom
        self.brain.zones['media'] = {
            'x': screen_width // 2 - 200,
            'y': screen_height - 310,
            'width': 400,
            'height': 300
        }
        
        # Update display
        self.update_zone_list()
        self.update_display()
    
    def update_display(self):
        """Update zone display with current zones"""
        if not self.zones or not self.zone_display.isVisible():
            return
            
        # Create pixmap for drawing
        pixmap = QPixmap(self.zone_display.width(), self.zone_display.height())
        pixmap.fill(QColor("#f0f0f0"))
        
        # Create painter
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Draw zones
        for zone_name, zone in self.zones.items():
            # Set color based on zone type
            if zone_name == 'active':
                color = QColor(255, 0, 0, 50)  # Red
                border_color = QColor(255, 0, 0, 100)
            elif zone_name == 'productivity':
                color = QColor(0, 255, 0, 50)  # Green
                border_color = QColor(0, 255, 0, 100)
            elif zone_name == 'notification':
                color = QColor(255, 255, 0, 50)  # Yellow
                border_color = QColor(255, 255, 0, 100)
            elif zone_name == 'media':
                color = QColor(0, 0, 255, 50)  # Blue
                border_color = QColor(0, 0, 255, 100)
            else:
                color = QColor(128, 128, 128, 50)  # Gray
                border_color = QColor(128, 128, 128, 100)
            
            # Highlight selected zone
            if zone_name == self.current_zone:
                border_color = QColor(255, 165, 0)  # Orange
                painter.setPen(QPen(border_color, 2, Qt.DashLine))
            else:
                painter.setPen(QPen(border_color, 1))
            
            # Draw zone rectangle
            painter.setBrush(QBrush(color))
            painter.drawRect(zone['x'], zone['y'], zone['width'], zone['height'])
            
            # Draw zone label
            painter.setPen(QPen(Qt.black))
            painter.drawText(
                zone['x'] + 5, 
                zone['y'] + 15,
                zone_name
            )
        
        # Draw screen center
        center_x = self.zone_display.width() // 2
        center_y = self.zone_display.height() // 2
        painter.setPen(QPen(QColor(100, 100, 100, 150), 1, Qt.DashLine))
        painter.drawLine(center_x, 0, center_x, self.zone_display.height())
        painter.drawLine(0, center_y, self.zone_display.width(), center_y)
        
        # End painting
        painter.end()
        
        # Set pixmap to label
        self.zone_display.setPixmap(pixmap)

class LogTextEditHandler(logging.Handler):
    """Custom log handler to display logs in QTextEdit"""
    
    def __init__(self, text_edit):
        """Initialize with text edit widget"""
        super().__init__()
        self.text_edit = text_edit
        self.text_edit.setMaximumBlockCount(2000)  # Limit for performance
        self.buffer = []
        self.buffer_size = 100
        self.auto_scroll = True
    
    def emit(self, record):
        """Process and display the log record"""
        try:
            msg = self.format(record)
            self.buffer.append((record.levelno, msg))
            
            # Keep buffer at reasonable size
            if len(self.buffer) > self.buffer_size:
                self.buffer.pop(0)
            
            # Set text color based on log level
            if record.levelno >= logging.ERROR:
                color = QColor(Qt.red)
            elif record.levelno >= logging.WARNING:
                color = QColor(QColor.fromRgb(255, 165, 0))  # Orange
            elif record.levelno >= logging.INFO:
                color = QColor(Qt.black)
            else:  # DEBUG and below
                color = QColor(Qt.gray)
            
            # Get current format
            cursor = self.text_edit.textCursor()
            current_format = cursor.charFormat()
            
            # Create format with new color
            log_format = QTextCharFormat(current_format)
            log_format.setForeground(color)
            
            # Remember current position
            old_pos = self.text_edit.verticalScrollBar().value()
            auto_scroll = (old_pos == self.text_edit.verticalScrollBar().maximum())
            
            # Set the format and add text
            cursor.movePosition(QTextCursor.End)
            cursor.insertText(msg + '\n', log_format)
            
            # Scroll to bottom if previously at bottom
            if self.auto_scroll and auto_scroll:
                self.text_edit.verticalScrollBar().setValue(
                    self.text_edit.verticalScrollBar().maximum()
                )
            
        except Exception:
            self.handleError(record)
    
    def dump_buffer(self):
        """Dump the current buffer to a string"""
        return '\n'.join([msg for _, msg in self.buffer])

class KovrychDebugPanel(QWidget):
    """Debug panel for monitoring and controlling Kovrycha"""
    
    def __init__(self, brain, config):
        """Initialize debug panel"""
        super().__init__()
        self.brain = brain
        self.config = config
        self.sensory = None
        self.behavior = None
        
        # Track when we last updated performance stats
        self.last_performance_update = time.time()
        
        # Setup window
        self.setup_window()
        
        # Create UI
        self.setup_ui()
        
        # Start update timer (4 updates per second)
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.update_info)
        self.update_timer.start(250)
        
        # Setup data history for charts
        self.data_history = {
            'energy': [],
            'mouse_activity': [],
            'visual_change': []
        }
        self.history_length = 100
        
        logger.info("Debug panel initialized")
    
    def setup_window(self):
        """Setup window properties"""
        self.setWindowTitle('Kovrycha Debug Panel')
        self.setMinimumSize(700, 500)
        self.setWindowFlags(Qt.Window | Qt.WindowStaysOnTopHint)
        
        # Set window icon if available
        icon_path = os.path.join(os.path.dirname(__file__), '..', 'resources', 'icons', 'debug.png')
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
    
    def setup_ui(self):
        """Setup the user interface"""
        # Main layout
        main_layout = QVBoxLayout()
        
        # Create tab widget
        self.tab_widget = QTabWidget()
        
        # Create tabs
        self.create_state_tab()
        self.create_sensors_tab()
        self.create_settings_tab()
        self.create_zones_tab()
        self.create_appearance_tab()
        self.create_logs_tab()
        
        # Add tabs to widget
        main_layout.addWidget(self.tab_widget)
        
        # Create bottom button panel
        button_layout = QHBoxLayout()
        
        # Add mood force buttons
        self.mood_combo = QComboBox()
        for mood in self.config['mood_properties'].keys():
            self.mood_combo.addItem(mood.capitalize())
        button_layout.addWidget(QLabel('Set Mood:'))
        button_layout.addWidget(self.mood_combo)
        
        self.set_mood_button = QPushButton('Apply')
        self.set_mood_button.clicked.connect(self.on_set_mood)
        button_layout.addWidget(self.set_mood_button)
        
        button_layout.addStretch()
        
        save_config_button = QPushButton('Save Config')
        save_config_button.clicked.connect(self.on_save_config)
        button_layout.addWidget(save_config_button)
        
        self.reset_button = QPushButton('Reset State')
        self.reset_button.clicked.connect(self.on_reset_state)
        button_layout.addWidget(self.reset_button)
        
        # Add button panel to layout
        main_layout.addLayout(button_layout)
        
        # Set layout
        self.setLayout(main_layout)
        
        # Create a status bar
        self.status_bar = QLabel("Ready")
        main_layout.addWidget(self.status_bar)
    
    def create_state_tab(self):
        """Create the state monitoring tab"""
        state_tab = QWidget()
        layout = QVBoxLayout()
        
        # Split into left/right panels
        splitter = QSplitter(Qt.Horizontal)
        
        # Left panel - status
        left_panel = QWidget()
        left_layout = QVBoxLayout()
        left_panel.setLayout(left_layout)
        
        # Create mood status display
        mood_group = QGroupBox('Mood State')
        mood_layout = QFormLayout()
        
        self.mood_label = QLabel('calm')
        self.energy_label = QLabel('0.5')
        self.curiosity_label = QLabel('0.7')
        self.last_activity_label = QLabel('N/A')
        
        # Use a monospaced font for values
        value_font = QFont('Courier New', 10)
        self.mood_label.setFont(value_font)
        self.energy_label.setFont(value_font)
        self.curiosity_label.setFont(value_font)
        self.last_activity_label.setFont(value_font)
        
        mood_layout.addRow('Current Mood:', self.mood_label)
        mood_layout.addRow('Energy Level:', self.energy_label)
        mood_layout.addRow('Curiosity Level:', self.curiosity_label)
        mood_layout.addRow('Last Activity:', self.last_activity_label)
        
        mood_group.setLayout(mood_layout)
        left_layout.addWidget(mood_group)
        
        # Add energy chart
        energy_chart_group = QGroupBox('Energy History')
        energy_chart_layout = QVBoxLayout()
        self.energy_chart = HistoryChart("Energy Level")
        energy_chart_layout.addWidget(self.energy_chart)
        energy_chart_group.setLayout(energy_chart_layout)
        left_layout.addWidget(energy_chart_group)
        
        # Right panel - activity
        right_panel = QWidget()
        right_layout = QVBoxLayout()
        right_panel.setLayout(right_layout)
        
        # Recent activity table
        activity_group = QGroupBox('Recent Activity')
        activity_layout = QVBoxLayout()
        
        self.activity_table = QTableWidget(0, 4)
        self.activity_table.setHorizontalHeaderLabels(['Time', 'Zone', 'Activity', 'Response'])
        
        # Set column stretch
        header = self.activity_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.Stretch)
        header.setSectionResizeMode(3, QHeaderView.Stretch)
        
        activity_layout.addWidget(self.activity_table)
        
        # Add clear button
        clear_button = QPushButton("Clear History")
        clear_button.clicked.connect(self.on_clear_history)
        activity_layout.addWidget(clear_button)
        
        activity_group.setLayout(activity_layout)
        right_layout.addWidget(activity_group)
        
        # Add panels to splitter
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([300, 400])
        
        layout.addWidget(splitter)
        state_tab.setLayout(layout)
        self.tab_widget.addTab(state_tab, 'State')
    
    def create_sensors_tab(self):
        """Create the sensors monitoring tab"""
        sensors_tab = QWidget()
        layout = QVBoxLayout()
        
        # Create top section with sensor information
        top_layout = QHBoxLayout()
        
        # Mouse information
        mouse_group = QGroupBox('Mouse')
        mouse_layout = QFormLayout()
        
        self.mouse_position_label = QLabel('(0, 0)')
        self.mouse_velocity_label = QLabel('(0, 0)')
        self.mouse_activity_label = QLabel('0.0')
        
        # Use a monospaced font for values
        value_font = QFont('Courier New', 10)
        self.mouse_position_label.setFont(value_font)
        self.mouse_velocity_label.setFont(value_font)
        self.mouse_activity_label.setFont(value_font)
        
        mouse_layout.addRow('Position:', self.mouse_position_label)
        mouse_layout.addRow('Velocity:', self.mouse_velocity_label)
        mouse_layout.addRow('Activity Level:', self.mouse_activity_label)
        
        mouse_group.setLayout(mouse_layout)
        top_layout.addWidget(mouse_group)
        
        # Screen information
        screen_group = QGroupBox('Screen')
        screen_layout = QFormLayout()
        
        self.active_zone_label = QLabel('background')
        self.visual_change_label = QLabel('0.0')
        self.active_window_label = QLabel('N/A')
        
        self.active_zone_label.setFont(value_font)
        self.visual_change_label.setFont(value_font)
        self.active_window_label.setFont(value_font)
        
        screen_layout.addRow('Active Zone:', self.active_zone_label)
        screen_layout.addRow('Visual Change:', self.visual_change_label)
        screen_layout.addRow('Active Window:', self.active_window_label)
        
        screen_group.setLayout(screen_layout)
        top_layout.addWidget(screen_group)
        
        # Kovrycha sensors
        kovrycha_group = QGroupBox('Kovrycha')
        kovrycha_layout = QFormLayout()
        
        self.kovrycha_position_label = QLabel('(0, 0)')
        self.kovrycha_velocity_label = QLabel('(0, 0)')
        self.kovrycha_radius_label = QLabel('30')
        
        self.kovrycha_position_label.setFont(value_font)
        self.kovrycha_velocity_label.setFont(value_font)
        self.kovrycha_radius_label.setFont(value_font)
        
        kovrycha_layout.addRow('Position:', self.kovrycha_position_label)
        kovrycha_layout.addRow('Velocity:', self.kovrycha_velocity_label)
        kovrycha_layout.addRow('Current Radius:', self.kovrycha_radius_label)
        
        kovrycha_group.setLayout(kovrycha_layout)
        top_layout.addWidget(kovrycha_group)
        
        layout.addLayout(top_layout)
        
        # Create charts for sensor data
        chart_layout = QVBoxLayout()
        
        # Activity chart
        activity_group = QGroupBox('Activity Levels')
        activity_layout = QVBoxLayout()
        
        self.activity_chart = HistoryChart("Activity")
        self.activity_chart.add_series("mouse", QColor(0, 120, 215))
        self.activity_chart.add_series("visual", QColor(215, 0, 120))
        activity_layout.addWidget(self.activity_chart)
        
        activity_group.setLayout(activity_layout)
        chart_layout.addWidget(activity_group)
        
        # Add performance graph if matplotlib is available
        if HAS_MATPLOTLIB:
            performance_group = QGroupBox('Performance')
            performance_layout = QVBoxLayout()
            
            # Create matplotlib figure
            self.performance_figure = Figure(figsize=(5, 3), dpi=100)
            self.performance_canvas = FigureCanvas(self.performance_figure)
            performance_layout.addWidget(self.performance_canvas)
            
            # Create axes
            self.performance_ax = self.performance_figure.add_subplot(111)
            self.performance_ax.set_title('CPU & Memory Usage')
            self.performance_ax.set_xlabel('Time')
            self.performance_ax.set_ylabel('Usage %')
            self.performance_ax.grid(True)
            
            # Initialize data
            self.perf_time_data = []
            self.perf_cpu_data = []
            self.perf_memory_data = []
            
            # Create lines
            self.cpu_line, = self.performance_ax.plot([], [], 'r-', label='CPU')
            self.memory_line, = self.performance_ax.plot([], [], 'b-', label='Memory')
            self.performance_ax.legend()
            
            performance_group.setLayout(performance_layout)
            chart_layout.addWidget(performance_group)
        
        layout.addLayout(chart_layout)
        
        sensors_tab.setLayout(layout)
        self.tab_widget.addTab(sensors_tab, 'Sensors')
    
    def create_settings_tab(self):
        """Create the settings tab"""
        settings_tab = QWidget()
        layout = QVBoxLayout()
        
        # Create scrollable area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        # Visual settings
        visual_group = QGroupBox('Visual Settings')
        visual_layout = QFormLayout()
        
        self.base_radius_spinner = QSpinBox()
        self.base_radius_spinner.setRange(10, 100)
        self.base_radius_spinner.setValue(self.config.get('base_radius', 30))
        self.base_radius_spinner.valueChanged.connect(self.on_base_radius_changed)
        
        self.transparency_spinner = QDoubleSpinBox()
        self.transparency_spinner.setRange(0.1, 1.0)
        self.transparency_spinner.setSingleStep(0.1)
        self.transparency_spinner.setValue(self.config.get('transparency', 0.8))
        self.transparency_spinner.valueChanged.connect(self.on_transparency_changed)
        
        self.fps_spinner = QSpinBox()
        self.fps_spinner.setRange(15, 120)
        self.fps_spinner.setValue(self.config.get('fps_limit', 60))
        self.fps_spinner.valueChanged.connect(self.on_fps_changed)
        
        visual_layout.addRow('Base Radius:', self.base_radius_spinner)
        visual_layout.addRow('Transparency:', self.transparency_spinner)
        visual_layout.addRow('FPS Limit:', self.fps_spinner)
        
        visual_group.setLayout(visual_layout)
        scroll_layout.addWidget(visual_group)
        
        # Movement settings
        movement_group = QGroupBox('Movement Settings')
        movement_layout = QFormLayout()
        
        self.move_speed_spinner = QDoubleSpinBox()
        self.move_speed_spinner.setRange(0.1, 5.0)
        self.move_speed_spinner.setSingleStep(0.1)
        self.move_speed_spinner.setValue(self.config.get('move_speed_multiplier', 1.0))
        self.move_speed_spinner.valueChanged.connect(self.on_move_speed_changed)
        
        self.friction_spinner = QDoubleSpinBox()
        self.friction_spinner.setRange(0.5, 0.99)
        self.friction_spinner.setSingleStep(0.01)
        self.friction_spinner.setValue(self.config.get('friction', 0.95))
        self.friction_spinner.valueChanged.connect(self.on_friction_changed)
        
        self.bounce_spinner = QDoubleSpinBox()
        self.bounce_spinner.setRange(0.1, 1.0)
        self.bounce_spinner.setSingleStep(0.1)
        self.bounce_spinner.setValue(self.config.get('boundary_bounce_factor', 0.7))
        self.bounce_spinner.valueChanged.connect(self.on_bounce_changed)
        
        movement_layout.addRow('Speed Multiplier:', self.move_speed_spinner)
        movement_layout.addRow('Friction:', self.friction_spinner)
        movement_layout.addRow('Bounce Factor:', self.bounce_spinner)
        
        movement_group.setLayout(movement_layout)
        scroll_layout.addWidget(movement_group)
        
        # Sensitivity settings
        sensitivity_group = QGroupBox('Sensitivity Settings')
        sensitivity_layout = QFormLayout()
        
        self.mouse_sensitivity_spinner = QDoubleSpinBox()
        self.mouse_sensitivity_spinner.setRange(0.1, 5.0)
        self.mouse_sensitivity_spinner.setSingleStep(0.1)
        self.mouse_sensitivity_spinner.setValue(self.config.get('mouse_activity_sensitivity', 1.0))
        self.mouse_sensitivity_spinner.valueChanged.connect(self.on_mouse_sensitivity_changed)
        
        self.visual_sensitivity_spinner = QDoubleSpinBox()
        self.visual_sensitivity_spinner.setRange(0.1, 5.0)
        self.visual_sensitivity_spinner.setSingleStep(0.1)
        self.visual_sensitivity_spinner.setValue(self.config.get('visual_change_sensitivity', 1.0))
        self.visual_sensitivity_spinner.valueChanged.connect(self.on_visual_sensitivity_changed)
        
        sensitivity_layout.addRow('Mouse Sensitivity:', self.mouse_sensitivity_spinner)
        sensitivity_layout.addRow('Visual Sensitivity:', self.visual_sensitivity_spinner)
        
        sensitivity_group.setLayout(sensitivity_layout)
        scroll_layout.addWidget(sensitivity_group)
        
        # Mood transition settings
        mood_group = QGroupBox('Mood Settings')
        mood_layout = QFormLayout()
        
        self.mood_transition_spinner = QDoubleSpinBox()
        self.mood_transition_spinner.setRange(0.1, 5.0)
        self.mood_transition_spinner.setSingleStep(0.1)
        self.mood_transition_spinner.setValue(self.config.get('mood_transition_speed', 1.0))
        self.mood_transition_spinner.valueChanged.connect(self.on_mood_transition_changed)
        
        mood_layout.addRow('Transition Speed:', self.mood_transition_spinner)
        
        mood_group.setLayout(mood_layout)
        scroll_layout.addWidget(mood_group)
        
        # Options
        options_group = QGroupBox('Options')
        options_layout = QVBoxLayout()
        
        self.primary_screen_checkbox = QCheckBox('Primary Screen Only')
        self.primary_screen_checkbox.setChecked(self.config.get('primary_screen_only', True))
        self.primary_screen_checkbox.stateChanged.connect(self.on_primary_screen_changed)
        
        self.start_minimized_checkbox = QCheckBox('Start Minimized')
        self.start_minimized_checkbox.setChecked(self.config.get('start_minimized', False))
        self.start_minimized_checkbox.stateChanged.connect(self.on_start_minimized_changed)
        
        self.advanced_analysis_checkbox = QCheckBox('Enable Advanced Screen Analysis')
        self.advanced_analysis_checkbox.setChecked(self.config.get('enable_advanced_analysis', False))
        self.advanced_analysis_checkbox.stateChanged.connect(self.on_advanced_analysis_changed)
        
        options_layout.addWidget(self.primary_screen_checkbox)
        options_layout.addWidget(self.start_minimized_checkbox)
        options_layout.addWidget(self.advanced_analysis_checkbox)
        
        options_group.setLayout(options_layout)
        scroll_layout.addWidget(options_group)
        
        # Add a stretch to push everything to the top
        scroll_layout.addStretch()
        
        # Set the scroll content
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        settings_tab.setLayout(layout)
        self.tab_widget.addTab(settings_tab, 'Settings')
    
    def create_zones_tab(self):
        """Create the zones configuration tab"""
        zones_tab = QWidget()
        layout = QVBoxLayout()
        
        # Create zone inspector
        self.zone_inspector = ZoneInspector()
        layout.addWidget(self.zone_inspector)
        
        zones_tab.setLayout(layout)
        self.tab_widget.addTab(zones_tab, 'Zones')
    
    def create_appearance_tab(self):
        """Create the appearance configuration tab"""
        appearance_tab = QWidget()
        layout = QVBoxLayout()
        
        # Create color editor
        colors_group = QGroupBox('Mood Colors')
        colors_layout = QVBoxLayout()
        
        # Create color grid
        mood_colors_layout = QFormLayout()
        self.color_buttons = {}
        
        for mood, colors in self.config['mood_colors'].items():
            # Create color buttons
            color_layout = QHBoxLayout()
            
            for i, color in enumerate(colors):
                button = QPushButton()
                button.setFixedSize(30, 30)
                button.setStyleSheet(f"background-color: {color}; border: 1px solid #999999;")
                button.clicked.connect(lambda checked, m=mood, idx=i: self.on_color_button_clicked(m, idx))
                color_layout.addWidget(button)
                
                # Store button reference
                if mood not in self.color_buttons:
                    self.color_buttons[mood] = []
                self.color_buttons[mood].append(button)
            
            # Add spacer
            color_layout.addStretch()
            
            # Create preview
            preview = QFrame()
            preview.setFixedSize(30, 30)
            preview.setStyleSheet(f"background-color: qlineargradient(spread:pad, x1:0, y1:0, x2:1, y2:0, "
                                f"stop:0 {colors[0]}, stop:1 {colors[1]});"
                                f"border-radius: 15px; border: 1px solid #999999;")
            color_layout.addWidget(preview)
            
            # Add to form layout
            mood_colors_layout.addRow(mood.capitalize() + ":", color_layout)
        
        colors_layout.addLayout(mood_colors_layout)
        
        # Add reset button
        reset_colors_button = QPushButton("Reset to Default Colors")
        reset_colors_button.clicked.connect(self.on_reset_colors)
        colors_layout.addWidget(reset_colors_button)
        
        colors_group.setLayout(colors_layout)
        layout.addWidget(colors_group)
        
        # Add pulse and movement speed controls
        speed_group = QGroupBox('Animation Speeds')
        speed_layout = QVBoxLayout()
        
        # Create table for pulse and movement speeds
        speed_table = QTableWidget(len(self.config['mood_properties']), 3)
        speed_table.setHorizontalHeaderLabels(['Mood', 'Pulse Speed', 'Move Speed'])
        
        # Fill table
        for i, (mood, props) in enumerate(sorted(self.config['mood_properties'].items())):
            # Mood
            mood_item = QTableWidgetItem(mood.capitalize())
            mood_item.setFlags(mood_item.flags() & ~Qt.ItemIsEditable)  # Make read-only
            speed_table.setItem(i, 0, mood_item)
            
            # Pulse speed
            pulse_spinner = QDoubleSpinBox()
            pulse_spinner.setRange(0.001, 0.1)
            pulse_spinner.setSingleStep(0.001)
            pulse_spinner.setDecimals(3)
            pulse_spinner.setValue(props['pulse_speed'])
            pulse_spinner.valueChanged.connect(lambda value, m=mood: self.on_pulse_speed_changed(m, value))
            speed_table.setCellWidget(i, 1, pulse_spinner)
            
            # Move speed
            move_spinner = QDoubleSpinBox()
            move_spinner.setRange(0.1, 5.0)
            move_spinner.setSingleStep(0.1)
            move_spinner.setValue(props['move_speed'])
            move_spinner.valueChanged.connect(lambda value, m=mood: self.on_move_speed_changed_for_mood(m, value))
            speed_table.setCellWidget(i, 2, move_spinner)
        
        # Set column stretch
        header = speed_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.Stretch)
        
        speed_layout.addWidget(speed_table)
        speed_group.setLayout(speed_layout)
        layout.addWidget(speed_group)
        
        appearance_tab.setLayout(layout)
        self.tab_widget.addTab(appearance_tab, 'Appearance')
    
    def create_logs_tab(self):
        """Create the logs tab"""
        logs_tab = QWidget()
        layout = QVBoxLayout()
        
        # Log text area
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        
        # Set monospace font for log display
        log_font = QFont('Courier New', 9)
        self.log_text.setFont(log_font)
        
        layout.addWidget(self.log_text)
        
        # Add buttons for log control
        button_layout = QHBoxLayout()
        
        # Log level combo
        level_layout = QHBoxLayout()
        level_layout.addWidget(QLabel("Log Level:"))
        
        self.log_level_combo = QComboBox()
        self.log_level_combo.addItems(["DEBUG", "INFO", "WARNING", "ERROR"])
        self.log_level_combo.setCurrentIndex(1)  # INFO
        self.log_level_combo.currentIndexChanged.connect(self.on_log_level_changed)
        level_layout.addWidget(self.log_level_combo)
        
        button_layout.addLayout(level_layout)
        
        # Auto-scroll checkbox
        self.auto_scroll_checkbox = QCheckBox("Auto-scroll")
        self.auto_scroll_checkbox.setChecked(True)
        self.auto_scroll_checkbox.stateChanged.connect(self.on_auto_scroll_changed)
        button_layout.addWidget(self.auto_scroll_checkbox)
        
        button_layout.addStretch()
        
        clear_button = QPushButton('Clear Logs')
        clear_button.clicked.connect(self.on_clear_logs)
        button_layout.addWidget(clear_button)
        
        save_button = QPushButton('Save Logs')
        save_button.clicked.connect(self.on_save_logs)
        button_layout.addWidget(save_button)
        
        layout.addLayout(button_layout)
        
        logs_tab.setLayout(layout)
        self.tab_widget.addTab(logs_tab, 'Logs')
        
        # Setup log handler to capture logs
        self.log_handler = LogTextEditHandler(self.log_text)
        self.log_handler.setLevel(logging.INFO)
        
        # Set formatter and add to logger
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        self.log_handler.setFormatter(formatter)
        logging.getLogger('kovrycha').addHandler(self.log_handler)
    
    def set_components(self, sensory=None, behavior=None):
        """Set references to sensory and behavior components for enhanced debugging"""
        self.sensory = sensory
        self.behavior = behavior
        
        # Update UI with component references if available
        if behavior:
            # Update Kovrycha position information
            if hasattr(self, 'kovrycha_position_label'):
                pos = behavior.get_position()
                self.kovrycha_position_label.setText(f"({int(pos[0])}, {int(pos[1])})")
            
            if hasattr(self, 'kovrycha_velocity_label'):
                vel = behavior.get_velocity()
                self.kovrycha_velocity_label.setText(f"({vel[0]:.2f}, {vel[1]:.2f})")
            
            if hasattr(self, 'kovrycha_radius_label'):
                self.kovrycha_radius_label.setText(f"{behavior.radius:.1f}")
        
        # Set brain reference to zone inspector
        if hasattr(self, 'zone_inspector'):
            self.zone_inspector.set_brain(self.brain)
    
    def update_performance_stats(self, stats):
        """Update performance statistics display"""
        if not hasattr(self, 'perf_fps_label'):
            # Create performance section if it doesn't exist
            if hasattr(self, 'tab_widget'):
                performance_tab = QWidget()
                layout = QVBoxLayout()
                
                perf_group = QGroupBox('Performance Metrics')
                perf_layout = QFormLayout()
                
                self.perf_fps_label = QLabel("0.0")
                self.perf_frame_time_label = QLabel("0.0 ms")
                self.perf_memory_label = QLabel("0 MB")
                
                # Use monospaced font
                value_font = QFont('Courier New', 10)
                self.perf_fps_label.setFont(value_font)
                self.perf_frame_time_label.setFont(value_font)
                self.perf_memory_label.setFont(value_font)
                
                perf_layout.addRow('FPS:', self.perf_fps_label)
                perf_layout.addRow('Frame Time:', self.perf_frame_time_label)
                perf_layout.addRow('Memory Usage:', self.perf_memory_label)
                
                perf_group.setLayout(perf_layout)
                layout.addWidget(perf_group)
                
                # Add CPU/GPU usage graphs if available
                # ...
                
                layout.addStretch()
                performance_tab.setLayout(layout)
                self.tab_widget.addTab(performance_tab, 'Performance')
        
        # Update performance labels
        if hasattr(self, 'perf_fps_label'):
            self.perf_fps_label.setText(f"{stats.get('fps', 0):.1f}")
        
        if hasattr(self, 'perf_frame_time_label'):
            frame_time = 1000.0 / max(1.0, stats.get('fps', 60))  # ms per frame
            self.perf_frame_time_label.setText(f"{frame_time:.1f} ms")
        
        # Update memory usage if available
        if hasattr(self, 'perf_memory_label'):
            try:
                if HAS_PSUTIL:
                    process = psutil.Process()
                    memory_info = process.memory_info()
                    memory_mb = memory_info.rss / (1024 * 1024)
                    self.perf_memory_label.setText(f"{memory_mb:.1f} MB")
                else:
                    self.perf_memory_label.setText("N/A (psutil not installed)")
            except:
                self.perf_memory_label.setText("N/A")
        
        # Update performance graph if available
        if HAS_MATPLOTLIB and HAS_PSUTIL and hasattr(self, 'performance_canvas'):
            current_time = time.time()
            
            # Only update every second
            if current_time - self.last_performance_update > 1.0:
                self.last_performance_update = current_time
                
                try:
                    process = psutil.Process()
                    
                    # Get CPU and memory usage
                    cpu_percent = process.cpu_percent()
                    memory_percent = process.memory_percent()
                    
                    # Add data points
                    self.perf_time_data.append(len(self.perf_time_data))
                    self.perf_cpu_data.append(cpu_percent)
                    self.perf_memory_data.append(memory_percent)
                    
                    # Keep data within limits
                    max_points = 60
                    if len(self.perf_time_data) > max_points:
                        self.perf_time_data = self.perf_time_data[-max_points:]
                        self.perf_cpu_data = self.perf_cpu_data[-max_points:]
                        self.perf_memory_data = self.perf_memory_data[-max_points:]
                    
                    # Update plot
                    self.cpu_line.set_data(self.perf_time_data, self.perf_cpu_data)
                    self.memory_line.set_data(self.perf_time_data, self.perf_memory_data)
                    
                    # Adjust axes
                    self.performance_ax.set_xlim(0, max(10, len(self.perf_time_data)))
                    max_value = max(max(self.perf_cpu_data), max(self.perf_memory_data)) if self.perf_cpu_data else 10
                    self.performance_ax.set_ylim(0, max(10, max_value * 1.1))
                    
                    # Redraw
                    self.performance_canvas.draw()
                except Exception as e:
                    logger.debug(f"Error updating performance graph: {e}")
    
    @pyqtSlot()
    def update_info(self, sensory_data=None):
        """Update all displayed information"""
        try:
            # Update state tab
            debug_info = self.brain.get_debug_info()
            
            # Update labels
            self.mood_label.setText(debug_info['mood'])
            self.energy_label.setText(str(debug_info['energy']))
            self.curiosity_label.setText(str(debug_info['curiosity']))
            self.last_activity_label.setText(debug_info['last_activity'])
            
            # Update energy chart
            self.energy_chart.add_data_point("default", debug_info['energy'])
            
            # Update activity table
            history = debug_info.get('activity_history', [])
            self.activity_table.setRowCount(len(history))
            
            for i, entry in enumerate(reversed(history)):
                # Time
                time_item = QTableWidgetItem(
                    self.format_timestamp(entry.get('timestamp', 0))
                )
                self.activity_table.setItem(i, 0, time_item)
                
                # Zone
                zone_item = QTableWidgetItem(
                    entry.get('data', {}).get('zone', 'unknown')
                )
                self.activity_table.setItem(i, 1, zone_item)
                
                # Activity
                activity_str = ""
                data = entry.get('data', {})
                if data.get('mouse_active', False):
                    activity_str += f"Mouse ({data.get('mouse_activity', 0):.2f}) "
                if data.get('visual_change', 0) > 0.1:
                    activity_str += f"Visual ({data.get('visual_change', 0):.2f}) "
                if not activity_str:
                    activity_str = "Idle"
                
                activity_item = QTableWidgetItem(activity_str)
                self.activity_table.setItem(i, 2, activity_item)
                
                # Response
                response = entry.get('response', {})
                response_str = f"Mood: {response.get('mood', 'unknown')}, Energy: {response.get('energy', 0):.2f}"
                
                response_item = QTableWidgetItem(response_str)
                self.activity_table.setItem(i, 3, response_item)
            
            # Update sensors tab if visible
            if self.tab_widget.currentIndex() == 1:
                # Use provided sensory data or get the latest data from history
                data = sensory_data if sensory_data else (history[-1].get('data', {}) if history else {})
                
                # Update mouse info
                if 'mouse_x' in data and 'mouse_y' in data:
                    self.mouse_position_label.setText(
                        f"({int(data.get('mouse_x', 0))}, {int(data.get('mouse_y', 0))})"
                    )
                
                if 'mouse_velocity_x' in data and 'mouse_velocity_y' in data:
                    self.mouse_velocity_label.setText(
                        f"({int(data.get('mouse_velocity_x', 0))}, {int(data.get('mouse_velocity_y', 0))})"
                    )
                
                if 'mouse_activity' in data:
                    activity = data.get('mouse_activity', 0)
                    self.mouse_activity_label.setText(f"{activity:.2f}")
                    self.activity_chart.add_data_point("mouse", activity)
                
                # Update screen info
                if 'zone' in data:
                    self.active_zone_label.setText(data.get('zone', 'background'))
                
                if 'visual_change' in data:
                    change = data.get('visual_change', 0)
                    self.visual_change_label.setText(f"{change:.2f}")
                    self.activity_chart.add_data_point("visual", change)
                
                if 'window_title' in data:
                    self.active_window_label.setText(data.get('window_title', 'N/A'))
            
            # Update Kovrycha info if behavior reference is available
            if self.behavior:
                pos = self.behavior.get_position()
                self.kovrycha_position_label.setText(f"({int(pos[0])}, {int(pos[1])})")
                
                vel = self.behavior.get_velocity()
                self.kovrycha_velocity_label.setText(f"({vel[0]:.2f}, {vel[1]:.2f})")
                
                self.kovrycha_radius_label.setText(f"{self.behavior.radius:.1f}")
        
        except Exception as e:
            logger.error(f"Error updating debug panel: {e}")
            logger.debug(traceback.format_exc())
    
    def format_timestamp(self, timestamp):
        """Format timestamp for display"""
        return datetime.fromtimestamp(timestamp).strftime('%H:%M:%S')
    
    @pyqtSlot()
    def on_set_mood(self):
        """Set mood manually"""
        mood = self.mood_combo.currentText().lower()
        self.brain.mood = mood
        logger.info(f"Mood manually set to {mood}")
        self.status_bar.setText(f"Mood set to {mood}")
    
    @pyqtSlot()
    def on_reset_state(self):
        """Reset brain state"""
        self.brain.mood = self.config.get('initial_mood', 'calm')
        self.brain.energy = self.config.get('initial_energy', 0.5)
        self.brain.curiosity = self.config.get('initial_curiosity', 0.7)
        self.brain.last_activity = time.time()
        logger.info("Brain state reset")
        self.status_bar.setText("Brain state reset to defaults")
    
    @pyqtSlot()
    def on_save_config(self):
        """Save current configuration"""
        try:
            # Import here to avoid circular import
            from utils.config import save_config
            
            # Save config
            save_config(self.config, 'config.json')
            logger.info("Configuration saved to config.json")
            self.status_bar.setText("Configuration saved successfully")
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
            self.status_bar.setText(f"Error saving configuration: {e}")
    
    @pyqtSlot()
    def on_clear_history(self):
        """Clear activity history"""
        if self.brain:
            self.brain.activity_history = []
            self.activity_table.setRowCount(0)
            self.energy_chart.clear_data()
            self.status_bar.setText("Activity history cleared")
    
    @pyqtSlot(int)
    def on_base_radius_changed(self, value):
        """Handle base radius change"""
        self.config['base_radius'] = value
        logger.debug(f"Base radius changed to {value}")
        self.status_bar.setText(f"Base radius set to {value}")
    
    @pyqtSlot(float)
    def on_transparency_changed(self, value):
        """Handle transparency change"""
        self.config['transparency'] = value
        logger.debug(f"Transparency changed to {value}")
        self.status_bar.setText(f"Transparency set to {value}")
    
    @pyqtSlot(int)
    def on_fps_changed(self, value):
        """Handle FPS change"""
        self.config['fps_limit'] = value
        logger.debug(f"FPS limit changed to {value}")
        self.status_bar.setText(f"FPS limit set to {value}")
    
    @pyqtSlot(float)
    def on_move_speed_changed(self, value):
        """Handle move speed change"""
        self.config['move_speed_multiplier'] = value
        logger.debug(f"Move speed multiplier changed to {value}")
        self.status_bar.setText(f"Movement speed set to {value}")
    
    @pyqtSlot(float)
    def on_friction_changed(self, value):
        """Handle friction change"""
        self.config['friction'] = value
        logger.debug(f"Friction changed to {value}")
        self.status_bar.setText(f"Friction set to {value}")
    
    @pyqtSlot(float)
    def on_bounce_changed(self, value):
        """Handle bounce factor change"""
        self.config['boundary_bounce_factor'] = value
        logger.debug(f"Bounce factor changed to {value}")
        self.status_bar.setText(f"Bounce factor set to {value}")
    
    @pyqtSlot(float)
    def on_mouse_sensitivity_changed(self, value):
        """Handle mouse sensitivity change"""
        self.config['mouse_activity_sensitivity'] = value
        logger.debug(f"Mouse sensitivity changed to {value}")
        self.status_bar.setText(f"Mouse sensitivity set to {value}")
    
    @pyqtSlot(float)
    def on_visual_sensitivity_changed(self, value):
        """Handle visual sensitivity change"""
        self.config['visual_change_sensitivity'] = value
        logger.debug(f"Visual sensitivity changed to {value}")
        self.status_bar.setText(f"Visual sensitivity set to {value}")
    
    @pyqtSlot(float)
    def on_mood_transition_changed(self, value):
        """Handle mood transition speed change"""
        self.config['mood_transition_speed'] = value
        logger.debug(f"Mood transition speed changed to {value}")
        self.status_bar.setText(f"Mood transition speed set to {value}")
    
    @pyqtSlot(int)
    def on_primary_screen_changed(self, state):
        """Handle primary screen only toggle"""
        self.config['primary_screen_only'] = (state == Qt.Checked)
        logger.debug(f"Primary screen only set to {self.config['primary_screen_only']}")
        self.status_bar.setText(f"Primary screen only set to {self.config['primary_screen_only']}")
    
    @pyqtSlot(int)
    def on_start_minimized_changed(self, state):
        """Handle start minimized toggle"""
        self.config['start_minimized'] = (state == Qt.Checked)
        logger.debug(f"Start minimized set to {self.config['start_minimized']}")
        self.status_bar.setText(f"Start minimized set to {self.config['start_minimized']}")
    
    @pyqtSlot(int)
    def on_advanced_analysis_changed(self, state):
        """Handle advanced analysis toggle"""
        self.config['enable_advanced_analysis'] = (state == Qt.Checked)
        logger.debug(f"Advanced analysis set to {self.config['enable_advanced_analysis']}")
        self.status_bar.setText(f"Advanced analysis set to {self.config['enable_advanced_analysis']}")
    
    def on_color_button_clicked(self, mood, index):
        """Handle color button click for mood color selection"""
        try:
            # Get current color
            current_color = self.config['mood_colors'][mood][index]
            
            # Open color dialog
            color = QColorDialog.getColor(QColor(current_color), self, f"Select {mood} color {index+1}")
            
            # If color is valid, update
            if color.isValid():
                # Update config
                self.config['mood_colors'][mood][index] = color.name()
                
                # Update button style
                self.color_buttons[mood][index].setStyleSheet(f"background-color: {color.name()}; border: 1px solid #999999;")
                
                logger.debug(f"Updated {mood} color {index+1} to {color.name()}")
                self.status_bar.setText(f"Updated {mood} color to {color.name()}")
        except Exception as e:
            logger.error(f"Error setting color: {e}")
            self.status_bar.setText(f"Error setting color: {e}")
    
    def on_reset_colors(self):
        """Reset mood colors to default"""
        try:
            # Import default config
            from utils.config import DEFAULT_CONFIG
            
            # Update config
            self.config['mood_colors'] = DEFAULT_CONFIG['mood_colors']
            
            # Update buttons
            for mood, colors in self.config['mood_colors'].items():
                if mood in self.color_buttons:
                    for i, color in enumerate(colors):
                        if i < len(self.color_buttons[mood]):
                            self.color_buttons[mood][i].setStyleSheet(f"background-color: {color}; border: 1px solid #999999;")
            
            logger.info("Reset mood colors to defaults")
            self.status_bar.setText("Reset mood colors to defaults")
        except Exception as e:
            logger.error(f"Error resetting colors: {e}")
            self.status_bar.setText(f"Error resetting colors: {e}")
    
    def on_pulse_speed_changed(self, mood, value):
        """Handle pulse speed change for a mood"""
        if mood in self.config['mood_properties']:
            self.config['mood_properties'][mood]['pulse_speed'] = value
            logger.debug(f"Pulse speed for {mood} changed to {value}")
            self.status_bar.setText(f"Pulse speed for {mood} set to {value}")
    
    def on_move_speed_changed_for_mood(self, mood, value):
        """Handle move speed change for a mood"""
        if mood in self.config['mood_properties']:
            self.config['mood_properties'][mood]['move_speed'] = value
            logger.debug(f"Move speed for {mood} changed to {value}")
            self.status_bar.setText(f"Movement speed for {mood} set to {value}")
    
    @pyqtSlot(int)
    def on_log_level_changed(self, index):
        """Handle log level change"""
        levels = [logging.DEBUG, logging.INFO, logging.WARNING, logging.ERROR]
        if 0 <= index < len(levels):
            new_level = levels[index]
            self.log_handler.setLevel(new_level)
            logger.debug(f"Log level set to {logging.getLevelName(new_level)}")
    
    @pyqtSlot(int)
    def on_auto_scroll_changed(self, state):
        """Handle auto-scroll toggle"""
        self.log_handler.auto_scroll = (state == Qt.Checked)
    
    @pyqtSlot()
    def on_clear_logs(self):
        """Clear log display"""
        self.log_text.clear()
        self.status_bar.setText("Logs cleared")
    
    @pyqtSlot()
    def on_save_logs(self):
        """Save logs to file"""
        try:
            # Get save path from dialog
            filename, _ = QFileDialog.getSaveFileName(
                self,
                "Save Logs",
                f"kovrycha_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
                "Text Files (*.txt);;All Files (*)"
            )
            
            if filename:
                with open(filename, 'w') as f:
                    f.write(self.log_text.toPlainText())
                logger.info(f"Logs saved to {filename}")
                self.status_bar.setText(f"Logs saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving logs: {e}")
            self.status_bar.setText(f"Error saving logs: {e}")
    
    def closeEvent(self, event):
        """Handle window close event"""
        # Remove log handler
        logging.getLogger('kovrycha').removeHandler(self.log_handler)
        
        # Stop update timer
        if hasattr(self, 'update_timer'):
            self.update_timer.stop()
        
        # Accept the event
        event.accept()

if __name__ == "__main__":
    # This is for testing only
    app = QApplication(sys.argv)
    
    # Mock brain and config for testing
    class MockBrain:
        def __init__(self):
            self.mood = 'curious'
            self.energy = 0.7
            self.curiosity = 0.8
            self.last_activity = time.time()
            self.debug_mode = True
            self.activity_history = []
            self.zones = {
                'active': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
                'productivity': {'x': 200, 'y': 200, 'width': 300, 'height': 200},
                'notification': {'x': 500, 'y': 50, 'width': 150, 'height': 100},
                'media': {'x': 200, 'y': 400, 'width': 400, 'height': 200}
            }
        
        def get_debug_info(self):
            return {
                'mood': self.mood,
                'energy': self.energy,
                'curiosity': self.curiosity,
                'last_activity': '12:34:56',
                'activity_history': self.activity_history
            }
    
    config = {
        'debug_mode': True,
        'primary_screen_only': True,
        'base_radius': 30,
        'transparency': 0.8,
        'fps_limit': 60,
        'move_speed_multiplier': 1.0,
        'boundary_bounce_factor': 0.7,
        'friction': 0.95,
        'mouse_activity_sensitivity': 1.0,
        'visual_change_sensitivity': 1.0,
        'initial_mood': 'calm',
        'initial_energy': 0.5,
        'initial_curiosity': 0.7,
        'mood_transition_speed': 1.0,
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
        }
    }
    
    # Configure logging
    logging.basicConfig(level=logging.DEBUG)
    
    brain = MockBrain()
    panel = KovrychDebugPanel(brain, config)
    panel.show()
    
    sys.exit(app.exec_())