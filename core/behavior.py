#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha Behavior System
Manages movement, visual effects, and animations based on mood/energy.
"""

import time
import math
import random
import logging
import numpy as np
from PyQt5.QtCore import QObject, pyqtSignal, QPointF, QRectF
from PyQt5.QtGui import QPainter, QRadialGradient, QColor, QPen, QBrush
from perlin_noise import PerlinNoise

logger = logging.getLogger('kovrycha.behavior')

class KovrychaBehavior(QObject):
    """Manages Kovrycha's visual appearance and movement"""
    
    # Signal to request redraw
    redraw_requested = pyqtSignal()
    
    def __init__(self, brain, config, canvas_width, canvas_height):
        """Initialize behavior system"""
        super().__init__()
        self.brain = brain
        self.config = config
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height
        
        # Position and movement
        self.x = canvas_width / 2
        self.y = canvas_height / 2
        self.target_x = self.x
        self.target_y = self.y
        self.velocity_x = 0
        self.velocity_y = 0
        
        # Visual properties
        self.base_radius = config.get('base_radius', 30)
        self.radius = self.base_radius
        self.pulse_phase = 0
        self.color_phase = 0
        
        # Movement patterns using Perlin noise for natural, organic movement
        self.noise_x = PerlinNoise(octaves=3, seed=random.randint(1, 1000))
        self.noise_y = PerlinNoise(octaves=3, seed=random.randint(1, 1000))
        self.noise_offset = {
            'x': random.random() * 1000,
            'y': random.random() * 1000
        }
        
        # Effects tracking
        self.effects = []
        self.effect_timer = 0
        
        logger.info("Behavior system initialized")
    
    def resize_canvas(self, width, height):
        """Update canvas dimensions"""
        self.canvas_width = width
        self.canvas_height = height
        
        # Adjust position if outside new bounds
        if self.x > self.canvas_width:
            self.x = self.canvas_width / 2
        if self.y > self.canvas_height:
            self.y = self.canvas_height / 2
    
    def update(self, environment_data):
        """Update behavior based on mood and environment"""
        # Get current mood state
        mood_state = self.brain.get_current_mood_state()
        
        # Update pulse animation
        self.pulse_phase += mood_state['pulse_speed']
        self.color_phase += mood_state['pulse_speed'] * 0.5
        
        # Calculate pulsing radius
        pulse_amount = math.sin(self.pulse_phase) * 0.2 + 0.8
        self.radius = self.base_radius * (0.8 + (pulse_amount * mood_state['energy'] * 0.5))
        
        # Decide on movement behavior based on mood
        self.update_movement(mood_state, environment_data)
        
        # Apply physics
        self.apply_physics()
        
        # Update effects timer
        self.effect_timer += 0.016  # Assuming 60fps
        
        # Request redraw
        self.redraw_requested.emit()
    
    def update_movement(self, mood_state, environment_data):
        """Update movement behavior based on mood"""
        # Get noise values for organic movement
        offset_x = self.noise_offset['x']
        offset_y = self.noise_offset['y']
        
        noise_x = self.noise_x([offset_x]) * 2
        noise_y = self.noise_y([offset_y]) * 2
        
        self.noise_offset['x'] += 0.01
        self.noise_offset['y'] += 0.01
        
        # Base movement on mood
        if mood_state['mood'] == 'excited':
            # Quick, energetic movements
            self.target_x = self.x + noise_x * 20
            self.target_y = self.y + noise_y * 20
            
        elif mood_state['mood'] == 'curious':
            # Move toward mouse or active areas
            if 'mouse_x' in environment_data and 'mouse_y' in environment_data:
                self.target_x = self.x + (environment_data['mouse_x'] - self.x) * 0.05 + noise_x * 5
                self.target_y = self.y + (environment_data['mouse_y'] - self.y) * 0.05 + noise_y * 5
            
        elif mood_state['mood'] == 'calm':
            # Gentle drifting
            self.target_x = self.x + noise_x * 3
            self.target_y = self.y + noise_y * 3
            
        elif mood_state['mood'] == 'sleepy':
            # Very minimal movement
            self.target_x = self.x + noise_x * 1
            self.target_y = self.y + noise_y * 1
            
        elif mood_state['mood'] == 'alert':
            # Quick, direct movement toward point of interest
            if environment_data.get('zone') == 'notification':
                zone = self.brain.zones['notification']
                zone_center_x = zone['x'] + zone['width'] / 2
                zone_center_y = zone['y'] + zone['height'] / 2
                self.target_x = zone_center_x
                self.target_y = zone_center_y
            
        elif mood_state['mood'] == 'annoyed':
            # Erratic, jittery movements
            self.target_x = self.x + (random.random() * 2 - 1) * 15
            self.target_y = self.y + (random.random() * 2 - 1) * 15
            
        elif mood_state['mood'] == 'sad':
            # Slow, downward drift
            self.target_x = self.x + noise_x * 2
            self.target_y = min(self.y + 0.5, self.canvas_height - self.radius)
            
        elif mood_state['mood'] == 'reflective':
            # Circle around center
            center_x = self.canvas_width / 2
            center_y = self.canvas_height / 2
            angle = time.time() * 0.0005
            radius = min(self.canvas_width, self.canvas_height) * 0.3
            self.target_x = center_x + math.cos(angle) * radius
            self.target_y = center_y + math.sin(angle) * radius
        
        # Boundary checks
        self.target_x = max(self.radius, min(self.target_x, self.canvas_width - self.radius))
        self.target_y = max(self.radius, min(self.target_y, self.canvas_height - self.radius))
    
    def apply_physics(self):
        """Apply physical forces and constraints"""
        # Apply forces toward target position
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        
        # Add acceleration toward target
        self.velocity_x += dx * 0.01
        self.velocity_y += dy * 0.01
        
        # Apply friction
        friction = self.config.get('friction', 0.95)
        self.velocity_x *= friction
        self.velocity_y *= friction
        
        # Update position
        self.x += self.velocity_x
        self.y += self.velocity_y
        
        # Boundary collisions with bounce
        bounce = self.config.get('boundary_bounce_factor', 0.7)
        
        if self.x < self.radius:
            self.x = self.radius
            self.velocity_x *= -bounce
        elif self.x > self.canvas_width - self.radius:
            self.x = self.canvas_width - self.radius
            self.velocity_x *= -bounce
        
        if self.y < self.radius:
            self.y = self.radius
            self.velocity_y *= -bounce
        elif self.y > self.canvas_height - self.radius:
            self.y = self.canvas_height - self.radius
            self.velocity_y *= -bounce
    
    def render(self, painter):
        """Render Kovrycha to canvas"""
        # Get current mood state
        mood_state = self.brain.get_current_mood_state()
        
        # Create gradient
        gradient_index = int(self.color_phase) % 3
        colors = mood_state['colors']
        
        color1 = QColor(colors[gradient_index % len(colors)])
        color2 = QColor(colors[(gradient_index + 1) % len(colors)])
        
        # Create radial gradient
        gradient = QRadialGradient(self.x, self.y, self.radius * 2)
        gradient.setColorAt(0, color1)
        gradient.setColorAt(0.7, color2)
        gradient.setColorAt(1, QColor(255, 255, 255, 0))
        
        # Draw main blob
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(gradient))
        painter.drawEllipse(QPointF(self.x, self.y), self.radius, self.radius)
        
        # Draw mood-specific visual effects
        if mood_state['mood'] == 'excited':
            self.draw_excited_effect(painter)
        elif mood_state['mood'] == 'alert':
            self.draw_alert_effect(painter)
        elif mood_state['mood'] == 'curious':
            self.draw_curious_effect(painter)
        
        # Draw debug visualization if enabled
        if self.brain.debug_mode:
            self.draw_debug_visualization(painter)
    
    def draw_excited_effect(self, painter):
        """Draw sparkle effects for excited mood"""
        # Sparkle effect for excited mood
        spark_count = 5
        outer_radius = self.radius * 1.5
        
        painter.save()
        for i in range(spark_count):
            angle = (math.pi * 2 / spark_count * i) + (time.time() * 0.005)
            offset_x = math.cos(angle) * outer_radius
            offset_y = math.sin(angle) * outer_radius
            
            size = 3 + math.sin(time.time() * 0.01 + i) * 2
            
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(QColor(255, 255, 255, 204)))  # 80% white
            painter.drawEllipse(QPointF(self.x + offset_x, self.y + offset_y), size, size)
        painter.restore()
    
    def draw_alert_effect(self, painter):
        """Draw pulsing ring for alert mood"""
        # Pulsing ring for alert mood
        ring_size = self.radius * (1.2 + math.sin(time.time() * 0.01) * 0.2)
        
        painter.save()
        alpha = int(179 + math.sin(time.time() * 0.01) * 76)  # 70-100% opacity
        pen = QPen(QColor(255, 0, 0, alpha))
        pen.setWidth(3)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(QPointF(self.x, self.y), ring_size, ring_size)
        painter.restore()
    
    def draw_curious_effect(self, painter):
        """Draw orbiting particles for curious mood"""
        # Small orbiting particles for curious mood
        particle_count = 3
        
        painter.save()
        for i in range(particle_count):
            speed = 0.002 + (i * 0.001)
            angle = (time.time() * speed) + (i * (math.pi * 2 / particle_count))
            distance = self.radius * 1.3
            
            x = self.x + math.cos(angle) * distance
            y = self.y + math.sin(angle) * distance
            
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(QColor(0, 200, 255, 179)))  # 70% opacity
            painter.drawEllipse(QPointF(x, y), 3, 3)
        painter.restore()
    
    def draw_debug_visualization(self, painter):
        """Draw debug information"""
        painter.save()
        
        # Draw target position
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(255, 0, 0, 128)))  # 50% red
        painter.drawEllipse(QPointF(self.target_x, self.target_y), 5, 5)
        
        # Draw velocity vector
        pen = QPen(QColor(0, 255, 0, 128))  # 50% green
        pen.setWidth(2)
        painter.setPen(pen)
        painter.drawLine(
            self.x, self.y,
            self.x + self.velocity_x * 10,
            self.y + self.velocity_y * 10
        )
        
        # Draw mood text
        painter.setPen(QPen(QColor(0, 0, 0)))
        painter.drawText(
            QPointF(self.x - 20, self.y - self.radius - 10),
            self.brain.mood
        )
        
        # Draw zones
        for zone_name, zone in self.brain.zones.items():
            # Set different colors for different zones
            if zone_name == 'active':
                color = QColor(255, 0, 0, 51)  # 20% red
            elif zone_name == 'productivity':
                color = QColor(0, 255, 0, 51)  # 20% green
            elif zone_name == 'notification':
                color = QColor(255, 255, 0, 51)  # 20% yellow
            elif zone_name == 'media':
                color = QColor(0, 0, 255, 51)  # 20% blue
            
            painter.setPen(QPen(QColor(0, 0, 0, 51)))  # 20% black
            painter.setBrush(QBrush(color))
            painter.drawRect(
                QRectF(
                    zone['x'], zone['y'],
                    zone['width'], zone['height']
                )
            )
            
            # Draw zone name
            painter.setPen(QPen(QColor(0, 0, 0)))
            painter.drawText(
                QPointF(zone['x'] + 5, zone['y'] + 15),
                zone_name
            )
        
        painter.restore()
    
    def get_position(self):
        """Get current position"""
        return (self.x, self.y)
    
    def get_velocity(self):
        """Get current velocity"""
        return (self.velocity_x, self.velocity_y)
    
    def set_position(self, x, y):
        """Manually set position"""
        self.x = x
        self.y = y
        self.target_x = x
        self.target_y = y
        self.velocity_x = 0
        self.velocity_y = 0