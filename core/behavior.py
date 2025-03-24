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
from PyQt5.QtCore import QObject, pyqtSignal, QPointF, QRectF, Qt
from PyQt5.QtGui import QPainter, QRadialGradient, QColor, QPen, QBrush, QTransform
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
        
        # Transition effects for smoother mood changes
        self.transition_progress = 1.0  # 1.0 means no transition in progress
        self.transition_from_mood = None
        self.transition_to_mood = None
        self.transition_speed = 0.05  # Speed of transition between moods
        
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
        self.particles = []  # For particle-based effects
        
        # Performance tracking
        self.last_update_time = time.time()
        self.frame_time = 0
        
        # Initialize effect systems
        self.init_effect_systems()
        
        logger.info("Behavior system initialized")
    
    def init_effect_systems(self):
        """Initialize effect subsystems"""
        # Different effect templates for moods
        self.effect_templates = {
            'excited': {
                'particle_count': 15,
                'particle_speed': 2.0,
                'particle_size': 3.5,
                'particle_lifespan': 1.5,
                'colors': ['#FFEA00', '#FF5722', '#FF9800']
            },
            'curious': {
                'particle_count': 8,
                'particle_speed': 1.2,
                'particle_size': 2.5,
                'particle_lifespan': 2.0,
                'colors': ['#03A9F4', '#4CAF50', '#00BCD4']
            },
            'alert': {
                'particle_count': 12,
                'particle_speed': 3.0,
                'particle_size': 4.0,
                'particle_lifespan': 0.8,
                'colors': ['#F44336', '#FFFFFF', '#F44336']
            },
            'reflective': {
                'particle_count': 6,
                'particle_speed': 0.7,
                'particle_size': 2.0,
                'particle_lifespan': 3.0,
                'colors': ['#9E9E9E', '#BDBDBD', '#E0E0E0']
            }
        }
    
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
        # Calculate delta time for smoother physics
        current_time = time.time()
        delta_time = min(0.1, current_time - self.last_update_time)  # Cap at 0.1s to prevent huge jumps
        self.last_update_time = current_time
        self.frame_time = delta_time
        
        # Get current mood state
        mood_state = self.brain.get_current_mood_state()
        
        # Handle mood transitions
        if self.transition_progress < 1.0:
            # Continue the transition
            self.transition_progress += self.transition_speed
            if self.transition_progress >= 1.0:
                # Transition complete
                self.transition_progress = 1.0
                self.transition_from_mood = None
                logger.debug(f"Mood transition to {self.transition_to_mood} complete")
        elif self.transition_from_mood != mood_state['mood']:
            # Start a new transition
            self.transition_from_mood = self.brain.mood
            self.transition_to_mood = mood_state['mood']
            self.transition_progress = 0.0
            logger.debug(f"Starting mood transition from {self.transition_from_mood} to {self.transition_to_mood}")
        
        # Update pulse animation
        self.pulse_phase += mood_state['pulse_speed'] * delta_time * 60  # Normalize for framerate
        self.color_phase += mood_state['pulse_speed'] * 0.5 * delta_time * 60
        
        # Calculate pulsing radius
        pulse_amount = math.sin(self.pulse_phase) * 0.2 + 0.8
        self.radius = self.base_radius * (0.8 + (pulse_amount * mood_state['energy'] * 0.5))
        
        # Decide on movement behavior based on mood
        self.update_movement(mood_state, environment_data, delta_time)
        
        # Apply physics
        self.apply_physics(delta_time)
        
        # Update effects and particles
        self.update_effects(delta_time, mood_state)
        
        # Request redraw
        self.redraw_requested.emit()
    
    def update_effects(self, delta_time, mood_state):
        """Update visual effects and particles"""
        # Update effect timer
        self.effect_timer += delta_time
        
        # Update existing particles
        updated_particles = []
        for particle in self.particles:
            # Update position
            particle['x'] += particle['vx'] * delta_time
            particle['y'] += particle['vy'] * delta_time
            
            # Update lifetime
            particle['life'] -= delta_time
            
            # Keep if still alive
            if particle['life'] > 0:
                updated_particles.append(particle)
        
        self.particles = updated_particles
        
        # Generate mood-specific particles
        if mood_state['mood'] in self.effect_templates:
            template = self.effect_templates[mood_state['mood']]
            spawn_chance = template['particle_count'] * delta_time * mood_state['energy']
            
            if random.random() < spawn_chance:
                # Determine emission point (from edge of Kovrycha)
                angle = random.random() * math.pi * 2
                distance = self.radius * (0.9 + random.random() * 0.2)  # Slight variation
                
                emit_x = self.x + math.cos(angle) * distance
                emit_y = self.y + math.sin(angle) * distance
                
                # Determine velocity (outward from center)
                speed = template['particle_speed'] * (0.7 + random.random() * 0.6)  # Speed variation
                vel_x = math.cos(angle) * speed
                vel_y = math.sin(angle) * speed
                
                # Determine color (from template)
                color = random.choice(template['colors'])
                
                # Create new particle
                particle = {
                    'x': emit_x,
                    'y': emit_y,
                    'vx': vel_x,
                    'vy': vel_y,
                    'size': template['particle_size'] * (0.8 + random.random() * 0.4),  # Size variation
                    'color': color,
                    'life': template['particle_lifespan'] * (0.7 + random.random() * 0.6),  # Lifespan variation
                    'initial_life': template['particle_lifespan'] * (0.7 + random.random() * 0.6)
                }
                
                self.particles.append(particle)
    
    def update_movement(self, mood_state, environment_data, delta_time):
        """Update movement behavior based on mood"""
        # Get noise values for organic movement
        offset_x = self.noise_offset['x']
        offset_y = self.noise_offset['y']
        
        noise_x = self.noise_x([offset_x]) * 2
        noise_y = self.noise_y([offset_y]) * 2
        
        # Update noise offsets based on delta time
        self.noise_offset['x'] += 0.01 * delta_time * 60
        self.noise_offset['y'] += 0.01 * delta_time * 60
        
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
    
    def apply_physics(self, delta_time):
        """Apply physical forces and constraints"""
        # Apply forces toward target position
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        
        # Add acceleration toward target, scaled by delta time
        acceleration_factor = 0.01 * 60 * delta_time
        self.velocity_x += dx * acceleration_factor
        self.velocity_y += dy * acceleration_factor
        
        # Apply friction, scaled for framerate independence
        friction = pow(self.config.get('friction', 0.95), delta_time * 60)
        self.velocity_x *= friction
        self.velocity_y *= friction
        
        # Update position based on velocity and delta time
        self.x += self.velocity_x * delta_time * 60
        self.y += self.velocity_y * delta_time * 60
        
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
        
        # Save painter state
        painter.save()
        
        # Render particles behind Kovrycha
        self.render_particles(painter, behind=True)
        
        # Create gradient for main blob
        self.render_main_blob(painter, mood_state)
        
        # Draw mood-specific visual effects
        self.render_mood_effects(painter, mood_state)
        
        # Render particles in front of Kovrycha
        self.render_particles(painter, behind=False)
        
        # Draw debug visualization if enabled
        if self.brain.debug_mode:
            self.draw_debug_visualization(painter)
        
        # Restore painter state
        painter.restore()
    
    def render_particles(self, painter, behind=True):
        """Render particle effects"""
        for particle in self.particles:
            # Determine if this particle should be rendered in this pass
            if (behind and particle['size'] > self.radius) or (not behind and particle['size'] <= self.radius):
                continue
                
            # Calculate opacity based on lifetime
            opacity = particle['life'] / particle['initial_life']
            
            # Set color with opacity
            color = QColor(particle['color'])
            color.setAlphaF(opacity * 0.7)  # 70% max opacity
            
            # Draw particle
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(color))
            painter.drawEllipse(
                QPointF(particle['x'], particle['y']),
                particle['size'],
                particle['size']
            )
    
    def render_main_blob(self, painter, mood_state):
        """Render the main Kovrycha blob"""
        # Determine colors based on mood transition if in progress
        if self.transition_progress < 1.0 and self.transition_from_mood and self.transition_to_mood:
            # Get colors for both moods
            from_colors = self.config['mood_colors'].get(self.transition_from_mood, 
                                                     self.config['mood_colors']['calm'])
            to_colors = self.config['mood_colors'].get(self.transition_to_mood, 
                                                   self.config['mood_colors']['calm'])
            
            # Interpolate colors
            gradient_index = int(self.color_phase) % 3
            from_color = QColor(from_colors[gradient_index % len(from_colors)])
            to_color = QColor(to_colors[gradient_index % len(to_colors)])
            
            # Create blended color
            color1 = self.blend_colors(from_color, to_color, self.transition_progress)
            
            # Get next gradient color
            from_color2 = QColor(from_colors[(gradient_index + 1) % len(from_colors)])
            to_color2 = QColor(to_colors[(gradient_index + 1) % len(to_colors)])
            color2 = self.blend_colors(from_color2, to_color2, self.transition_progress)
        else:
            # Use current mood colors
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
    
    def blend_colors(self, color1, color2, blend_factor):
        """Blend two QColors based on a factor (0-1)"""
        r = int(color1.red() * (1 - blend_factor) + color2.red() * blend_factor)
        g = int(color1.green() * (1 - blend_factor) + color2.green() * blend_factor)
        b = int(color1.blue() * (1 - blend_factor) + color2.blue() * blend_factor)
        a = int(color1.alpha() * (1 - blend_factor) + color2.alpha() * blend_factor)
        
        return QColor(r, g, b, a)
    
    def render_mood_effects(self, painter, mood_state):
        """Render mood-specific visual effects"""
        # Apply the appropriate effect based on mood
        if mood_state['mood'] == 'excited':
            self.draw_excited_effect(painter)
        elif mood_state['mood'] == 'alert':
            self.draw_alert_effect(painter)
        elif mood_state['mood'] == 'curious': 
            self.draw_curious_effect(painter)
        elif mood_state['mood'] == 'sad':
            self.draw_sad_effect(painter)
        elif mood_state['mood'] == 'reflective':
            self.draw_reflective_effect(painter)
        elif mood_state['mood'] == 'annoyed':
            self.draw_annoyed_effect(painter)
    
    def draw_excited_effect(self, painter):
        """Draw sparkle effects for excited mood"""
        # Sparkle effect for excited mood
        spark_count = 5
        outer_radius = self.radius * 1.5
        
        painter.save()
        for i in range(spark_count):
            angle = (math.pi * 2 / spark_count * i) + (time.time() * 0.005)
            offsetX = math.cos(angle) * outer_radius
            offsetY = math.sin(angle) * outer_radius
            
            size = 3 + math.sin(time.time() * 0.01 + i) * 2
            
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(QColor(255, 255, 255, 204)))  # 80% white
            painter.drawEllipse(QPointF(self.x + offsetX, self.y + offsetY), size, size)
            
            # Add a small trail
            trail_length = 5
            for j in range(1, trail_length):
                trail_size = size * (1 - j/trail_length)
                trail_alpha = 204 * (1 - j/trail_length)
                
                trail_offset = j * 3
                trail_x = self.x + offsetX - math.cos(angle) * trail_offset
                trail_y = self.y + offsetY - math.sin(angle) * trail_offset
                
                painter.setBrush(QBrush(QColor(255, 255, 255, int(trail_alpha))))
                painter.drawEllipse(QPointF(trail_x, trail_y), trail_size, trail_size)
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
        
        # Add secondary ring
        secondary_ring_size = self.radius * (1.4 + math.cos(time.time() * 0.015) * 0.2)
        secondary_alpha = int(128 + math.cos(time.time() * 0.015) * 50)
        pen.setColor(QColor(255, 100, 100, secondary_alpha))
        pen.setWidth(2)
        painter.setPen(pen)
        painter.drawEllipse(QPointF(self.x, self.y), secondary_ring_size, secondary_ring_size)
        
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
            
            # Main particle
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(QColor(0, 200, 255, 179)))  # 70% opacity
            painter.drawEllipse(QPointF(x, y), 3, 3)
            
            # Connecting line to center
            pen = QPen(QColor(0, 200, 255, 100)) # 40% opacity
            pen.setWidth(1)
            painter.setPen(pen)
            painter.drawLine(self.x, self.y, x, y)
        painter.restore()
    
    def draw_sad_effect(self, painter):
        """Draw sad effect with falling particles"""
        painter.save()
        
        # Slow falling "tears"
        tear_count = 2
        for i in range(tear_count):
            # Determine position based on time
            offset_angle = math.pi/6 * (i - tear_count/2 + 0.5)  # Spread tears a bit
            angle = math.pi/2 + offset_angle  # Down direction with offset
            
            # Base distance from center
            distance = self.radius * 1.1
            
            # Add oscillation to X position
            osc_x = math.sin(time.time() * 0.5 + i) * self.radius * 0.2
            
            # Y position drops over time and loops
            drop_speed = 30  # pixels per second
            y_offset = ((time.time() * drop_speed) % (self.radius * 3))
            
            # Calculate final position
            x = self.x + math.cos(angle) * distance + osc_x
            y = self.y + math.sin(angle) * distance + y_offset
            
            # Draw teardrop shape
            tear_size = 4
            gradient = QRadialGradient(x, y, tear_size * 2)
            gradient.setColorAt(0, QColor(100, 149, 237, 200))  # Cornflower blue
            gradient.setColorAt(1, QColor(100, 149, 237, 0))
            
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(gradient))
            
            # Draw a slightly elongated circle for teardrop effect
            transform = QTransform()
            transform.translate(x, y)
            transform.scale(1, 1.5)  # Elongate vertically
            transform.translate(-x, -y)
            painter.setTransform(transform)
            
            painter.drawEllipse(QPointF(x, y), tear_size, tear_size)
            
            # Reset transform
            painter.resetTransform()
        
        painter.restore()
    
    def draw_reflective_effect(self, painter):
        """Draw reflective/thoughtful effect"""
        painter.save()
        
        # Draw thought bubbles floating up and away
        bubble_count = 3
        base_size = self.radius * 0.2
        
        for i in range(bubble_count):
            # Determine cycle position (0 to 1) with offset for each bubble
            cycle = ((time.time() * 0.3) + (i / bubble_count)) % 1.0
            
            # Initially place bubbles at the top of Kovrycha
            distance = self.radius * (1 + cycle * 1.5)  # Moves away from center over time
            angle = -math.pi/2 - math.pi/6 + (math.pi/3 * i / (bubble_count-1))  # Spread across top in an arc
            
            # Add some gentle movement
            angle += math.sin(time.time() * 0.5 + i) * 0.1
            
            # Position
            x = self.x + math.cos(angle) * distance
            y = self.y + math.sin(angle) * distance
            
            # Size decreases as it moves away
            size = base_size * (1 - cycle * 0.7)
            
            # Opacity decreases toward the end of cycle
            opacity = 255
            if cycle > 0.7:
                opacity = int(255 * (1 - (cycle - 0.7) / 0.3))
            
            # Draw bubble
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(QColor(255, 255, 255, opacity)))
            painter.drawEllipse(QPointF(x, y), size, size)
        
        painter.restore()
    
    def draw_annoyed_effect(self, painter):
        """Draw annoyed effect with erratic movement"""
        painter.save()
        
        # Draw small "frustration" marks around Kovrycha
        mark_count = 6
        for i in range(mark_count):
            # Rotate marks over time
            time_offset = time.time() * 2
            angle = (math.pi * 2 / mark_count * i) + time_offset
            
            # Add randomness to distance
            random.seed(i + int(time_offset * 5))
            distance_var = random.random() * 0.2
            distance = self.radius * (1.2 + distance_var)
            
            # Calculate position
            x1 = self.x + math.cos(angle) * distance
            y1 = self.y + math.sin(angle) * distance
            
            # Calculate end point of mark (short line)
            mark_length = self.radius * 0.2
            x2 = x1 + math.cos(angle + math.pi/2) * mark_length
            y2 = y1 + math.sin(angle + math.pi/2) * mark_length
            
            # Draw mark
            pen = QPen(QColor(255, 100, 0, 200))
            pen.setWidth(2)
            painter.setPen(pen)
            painter.drawLine(x1, y1, x2, y2)
        
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
        
        # Draw particle count
        painter.drawText(
            QPointF(self.x - 20, self.y - self.radius - 25),
            f"Particles: {len(self.particles)}"
        )
        
        # Draw frame time
        painter.drawText(
            QPointF(self.x - 20, self.y - self.radius - 40),
            f"Frame: {self.frame_time*1000:.1f}ms"
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
            else:
                color = QColor(128, 128, 128, 51)  # 20% gray
            
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