#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kovrycha Brain - AI Decision Engine
Manages mood, energy, curiosity and other internal states.
"""

import time
import random
import logging
import json
from datetime import datetime

logger = logging.getLogger('kovrycha.brain')

class KovrychaBrain:
    """Central AI decision engine for Kovrycha"""
    
    def __init__(self, config):
        """Initialize brain with configuration"""
        self.config = config
        
        # Initialize state
        self.mood = config.get('initial_mood', 'calm')
        self.energy = config.get('initial_energy', 0.5)
        self.curiosity = config.get('initial_curiosity', 0.7)
        self.last_activity = time.time()
        self.debug_mode = config.get('debug_mode', False)
        
        # Activity zones (will be positioned during runtime)
        self.zones = {
            'active': {'x': 0, 'y': 0, 'width': config['zones']['active']['width'], 
                       'height': config['zones']['active']['height']},
            'productivity': {'x': 0, 'y': 0, 'width': config['zones']['productivity']['width'], 
                           'height': config['zones']['productivity']['height']},
            'notification': {'x': 0, 'y': 0, 'width': config['zones']['notification']['width'], 
                           'height': config['zones']['notification']['height']},
            'media': {'x': 0, 'y': 0, 'width': config['zones']['media']['width'], 
                    'height': config['zones']['media']['height']}
        }
        
        # Activity history
        self.activity_history = []
        self.max_history_length = 100
        
        logger.info(f"Brain initialized with mood: {self.mood}, energy: {self.energy}")
    
    def update_mood(self, environment_data):
        """Update internal state based on environment data"""
        # Time-based energy decay
        current_time = time.time()
        time_since_last_activity = current_time - self.last_activity
        
        if time_since_last_activity > 10:
            # Gradually decrease energy and move toward sleepy state when inactive
            self.energy = max(0.1, self.energy - 0.001 * time_since_last_activity)
            if self.energy < 0.3 and self.mood != 'sleepy':
                self.mood = 'sleepy'
                logger.debug("Mood changed to sleepy due to inactivity")
        
        # Process environmental stimuli
        if environment_data.get('mouse_activity', 0) > 0.7:
            self.energy = min(1.0, self.energy + 0.05)
            self.last_activity = current_time
            
            if environment_data.get('mouse_activity', 0) > 0.9:
                # Rapid mouse movements might indicate excitement or urgency
                if random.random() > 0.7:
                    old_mood = self.mood
                    self.mood = 'excited'
                    logger.debug(f"Mood changed from {old_mood} to excited due to high mouse activity")
            elif environment_data.get('zone') == 'productivity':
                # In productivity zone, be calm and unobtrusive
                if random.random() > 0.8:
                    old_mood = self.mood
                    self.mood = 'calm'
                    logger.debug(f"Mood changed from {old_mood} to calm in productivity zone")
            elif environment_data.get('zone') == 'active':
                # In active zone, show more curiosity
                if random.random() > 0.8:
                    old_mood = self.mood
                    self.mood = 'curious'
                    logger.debug(f"Mood changed from {old_mood} to curious in active zone")
        
        # Respond to notification zone activity
        if environment_data.get('zone') == 'notification' and environment_data.get('visual_change', 0) > 0.5:
            old_mood = self.mood
            self.mood = 'alert'
            self.energy = min(1.0, self.energy + 0.2)
            self.last_activity = current_time
            logger.debug(f"Mood changed from {old_mood} to alert due to notification activity")
        
        # Random mood transitions (with low probability)
        if random.random() > 0.995:
            mood_keys = list(self.config['mood_properties'].keys())
            old_mood = self.mood
            self.mood = random.choice(mood_keys)
            logger.debug(f"Random mood change from {old_mood} to {self.mood}")
        
        # Record activity for learning
        self.record_activity(environment_data)
    
    def record_activity(self, data):
        """Record activity data for history and learning"""
        self.activity_history.append({
            'timestamp': time.time(),
            'data': data.copy() if isinstance(data, dict) else data,
            'response': {
                'mood': self.mood,
                'energy': self.energy
            }
        })
        
        # Keep history at reasonable size
        if len(self.activity_history) > self.max_history_length:
            self.activity_history.pop(0)
    
    def get_current_mood_state(self):
        """Get current mood and related properties"""
        mood_props = self.config['mood_properties'].get(self.mood, self.config['mood_properties']['calm'])
        colors = self.config['mood_colors'].get(self.mood, self.config['mood_colors']['calm'])
        
        return {
            'mood': self.mood,
            'energy': self.energy,
            'colors': colors,
            'pulse_speed': mood_props['pulse_speed'] * self.energy * self.config.get('mood_transition_speed', 1.0),
            'move_speed': mood_props['move_speed'] * self.energy * self.config.get('move_speed_multiplier', 1.0)
        }
    
    def toggle_debug_mode(self):
        """Toggle debug mode"""
        self.debug_mode = not self.debug_mode
        self.config['debug_mode'] = self.debug_mode
        logger.info(f"Debug mode {'enabled' if self.debug_mode else 'disabled'}")
        return self.debug_mode
    
    def get_debug_info(self):
        """Get debug information about internal state"""
        return {
            'mood': self.mood,
            'energy': round(self.energy, 2),
            'curiosity': round(self.curiosity, 2),
            'last_activity': datetime.fromtimestamp(self.last_activity).strftime('%H:%M:%S'),
            'activity_history': self.activity_history[-5:] if self.activity_history else []  # Last 5 activities
        }
    
    def export_state(self):
        """Export brain state for save/load functionality"""
        return {
            'mood': self.mood,
            'energy': self.energy,
            'curiosity': self.curiosity,
            'last_activity': self.last_activity,
            'activity_history': self.activity_history
        }
    
    def import_state(self, state):
        """Import brain state from saved data"""
        if not state:
            return False
        
        try:
            self.mood = state.get('mood', self.mood)
            self.energy = state.get('energy', self.energy)
            self.curiosity = state.get('curiosity', self.curiosity)
            self.last_activity = state.get('last_activity', self.last_activity)
            
            if 'activity_history' in state and isinstance(state['activity_history'], list):
                self.activity_history = state['activity_history']
            
            logger.info("Brain state imported successfully")
            return True
        except Exception as e:
            logger.error(f"Error importing brain state: {e}")
            return False