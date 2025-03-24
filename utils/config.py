#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configuration utilities for Kovrycha
"""

import os
import json
import logging

logger = logging.getLogger('kovrycha.config')

DEFAULT_CONFIG = {
    # General settings
    "debug_mode": False,
    "primary_screen_only": False,
    "start_minimized": False,
    
    # Brain settings
    "initial_mood": "calm",
    "initial_energy": 0.5,
    "initial_curiosity": 0.7,
    "mood_transition_speed": 1.0,
    
    # Visual settings
    "base_radius": 30,
    "transparency": 0.8,
    "fps_limit": 60,
    
    # Movement settings
    "move_speed_multiplier": 1.0,
    "boundary_bounce_factor": 0.7,
    "friction": 0.95,
    
    # Sensory settings
    "mouse_activity_sensitivity": 1.0,
    "visual_change_sensitivity": 1.0,
    "activity_zone_size": 100,
    
    # Advanced features
    "enable_machine_learning": False,
    "collect_anonymous_usage_data": False,
    
    # Mood colors (RGB values)
    "mood_colors": {
        "excited": ["#FFEA00", "#FF5722", "#FF9800"],
        "curious": ["#03A9F4", "#4CAF50", "#00BCD4"],
        "calm": ["#3F51B5", "#9C27B0", "#00BCD4"],
        "sleepy": ["#5C6BC0", "#7986CB", "#9FA8DA"],
        "alert": ["#F44336", "#FFFFFF", "#F44336"],
        "annoyed": ["#F44336", "#FFEB3B", "#F44336"],
        "sad": ["#1A237E", "#303F9F", "#3949AB"],
        "reflective": ["#9E9E9E", "#BDBDBD", "#E0E0E0"]
    },
    
    # Mood properties
    "mood_properties": {
        "excited": {
            "pulse_speed": 0.03,
            "move_speed": 2.5
        },
        "curious": {
            "pulse_speed": 0.015,
            "move_speed": 1.8
        },
        "calm": {
            "pulse_speed": 0.008,
            "move_speed": 0.7
        },
        "sleepy": {
            "pulse_speed": 0.004,
            "move_speed": 0.3
        },
        "alert": {
            "pulse_speed": 0.05,
            "move_speed": 3.0
        },
        "annoyed": {
            "pulse_speed": 0.04,
            "move_speed": 2.0
        },
        "sad": {
            "pulse_speed": 0.005,
            "move_speed": 0.5
        },
        "reflective": {
            "pulse_speed": 0.01,
            "move_speed": 1.0
        }
    },
    
    # Zone settings
    "zones": {
        "active": {"width": 100, "height": 100},
        "productivity": {"width": 300, "height": 200},
        "notification": {"width": 200, "height": 100},
        "media": {"width": 400, "height": 300}
    }
}

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb_color):
    """Convert RGB tuple to hex color"""
    return '#{:02x}{:02x}{:02x}'.format(*rgb_color)

def load_config(config_path):
    """Load configuration from file, or create default if not exists"""
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                logger.info(f"Configuration loaded from {config_path}")
                
                # Merge with default config to ensure all keys exist
                merged_config = DEFAULT_CONFIG.copy()
                merged_config.update(config)
                return merged_config
        else:
            logger.warning(f"Configuration file not found at {config_path}, creating default")
            save_config(DEFAULT_CONFIG, config_path)
            return DEFAULT_CONFIG.copy()
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return DEFAULT_CONFIG.copy()

def save_config(config, config_path):
    """Save configuration to file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(config_path)), exist_ok=True)
        
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=4)
            logger.info(f"Configuration saved to {config_path}")
    except Exception as e:
        logger.error(f"Error saving configuration: {e}")

def get_color_for_mood(config, mood, phase=0):
    """Get color for specified mood with optional phase offset"""
    colors = config['mood_colors'].get(mood, config['mood_colors']['calm'])
    
    # Get two adjacent colors based on phase
    color_count = len(colors)
    idx1 = int(phase * color_count) % color_count
    idx2 = (idx1 + 1) % color_count
    
    color1 = hex_to_rgb(colors[idx1])
    color2 = hex_to_rgb(colors[idx2])
    
    # Calculate blend factor (0-1)
    blend = (phase * color_count) % 1.0
    
    # Interpolate between colors
    blended_color = tuple(
        int(color1[i] * (1 - blend) + color2[i] * blend)
        for i in range(3)
    )
    
    return blended_color