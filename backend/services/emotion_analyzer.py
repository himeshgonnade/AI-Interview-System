import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Check once at startup whether packages are available
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logging.warning("opencv-python-headless not installed. Run: pip install opencv-python-headless deepface")

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    logging.warning("DeepFace not installed. Emotion detection will return 'Neutral' as fallback.")

def analyze_emotion_from_base64(image_base64: str) -> Optional[str]:
    """
    Takes a base64 encoded image string (e.g. data:image/jpeg;base64,...),
    decodes it, and uses DeepFace to detect the dominant emotion.
    Maps to our custom categories: Nervous, Confident, Happy, Neutral.
    """
    if not image_base64:
        return None
    
    # Fallback if packages not installed
    if not CV2_AVAILABLE or not DEEPFACE_AVAILABLE:
        return "Neutral"
        
    try:
        # Strip header if present (e.g., 'data:image/jpeg;base64,')
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
            
        img_data = base64.b64decode(image_base64)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Failed to decode image")
            return None

        if not DEEPFACE_AVAILABLE:
            return "Neutral"

        # Analyze using DeepFace
        # enforce_detection=False so it doesn't crash if no face is perfectly aligned
        results = DeepFace.analyze(img, actions=['emotion'], enforce_detection=False, silent=True)
        
        # DeepFace can return a list if multiple faces are detected
        if isinstance(results, list):
            result = results[0]
        else:
            result = results
            
        dominant_emotion = result.get('dominant_emotion', 'neutral')
        
        # Map DeepFace emotions to our categories
        # DeepFace emotions: angry, disgust, fear, happy, sad, surprise, neutral
        emotion_map = {
            'angry': 'Nervous',
            'disgust': 'Nervous',
            'fear': 'Nervous',
            'sad': 'Nervous',
            'happy': 'Happy',
            'surprise': 'Confident', # Or maybe Neutral
            'neutral': 'Neutral'
        }
        
        return emotion_map.get(dominant_emotion.lower(), 'Neutral')

    except Exception as e:
        logger.error(f"Error analyzing emotion: {e}")
        return "Neutral"  # Fallback
