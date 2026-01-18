"""
Wood Wide AI API Client - Real Implementation
"""

import requests
import time
from typing import Optional, Dict, Any
import config


class WoodWideClient:
    """
    Client for Wood Wide AI numeric reasoning API.
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or config.WOODWIDE_API_KEY
        self.base_url = "https://beta.woodwide.ai"
        self.headers = {
            "accept": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        self.dataset_name = None
        self.dataset_id = None
        self.model_id = None
    
    def upload_dataset(self, csv_path: str, name: str, overwrite: bool = True) -> str:
        """
        Upload training CSV to Wood Wide.
        
        Returns:
            dataset_id
        """
        url = f"{self.base_url}/api/datasets"
        
        with open(csv_path, 'rb') as f:
            files = {"file": (csv_path, f, "text/csv")}
            data = {"name": name, "overwrite": str(overwrite).lower()}
            
            response = requests.post(
                url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                files=files,
                data=data
            )
        
        response.raise_for_status()
        result = response.json()
        self.dataset_id = result["id"]
        self.dataset_name = name
        print(f"[WOODWIDE] Dataset uploaded. ID: {self.dataset_id}")
        return self.dataset_id
    
    def train_model(self, model_name: str, label_column: str = "is_clench", overwrite: bool = True) -> str:
        """
        Train a prediction model.
        
        Returns:
            model_id
        """
        url = f"{self.base_url}/api/models/prediction/train?dataset_name={self.dataset_name}"
        
        data = {
            "model_name": model_name,
            "label_column": label_column,
            "overwrite": str(overwrite).lower()
        }
        
        response = requests.post(
            url,
            headers={**self.headers, "Content-Type": "application/x-www-form-urlencoded"},
            data=data
        )
        
        response.raise_for_status()
        result = response.json()
        self.model_id = result["id"]
        print(f"[WOODWIDE] Training started. Model ID: {self.model_id}")
        return self.model_id
    
    def wait_for_training(self, timeout: int = 300) -> bool:
        """
        Wait for model training to complete.
        
        Returns:
            True if training completed successfully
        """
        url = f"{self.base_url}/api/models/{self.model_id}"
        start_time = time.time()
        
        while True:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            result = response.json()
            
            status = result.get("training_status", "UNKNOWN")
            
            if status == "COMPLETE":
                print("[WOODWIDE] Training complete!")
                return True
            elif status == "FAILED":
                print("[WOODWIDE] Training failed!")
                return False
            
            elapsed = time.time() - start_time
            if elapsed >= timeout:
                print(f"[WOODWIDE] Training timeout after {timeout}s")
                return False
            
            print(f"[WOODWIDE] Status: {status}... waiting")
            time.sleep(2)
    
    def upload_inference_data(self, csv_path: str, name: str) -> str:
        """Upload data for inference."""
        return self.upload_dataset(csv_path, name, overwrite=True)
    
    def predict(self, inference_dataset_id: str) -> Dict:
        """
        Run inference on a dataset.
        
        Returns:
            Prediction results
        """
        url = f"{self.base_url}/api/models/prediction/{self.model_id}/infer?dataset_id={inference_dataset_id}"
        
        response = requests.post(
            url,
            headers={**self.headers, "Content-Type": "application/x-www-form-urlencoded"}
        )
        
        response.raise_for_status()
        return response.json()


class MockWoodWideClient:
    """Mock client for testing without API access."""
    
    def __init__(self):
        self.threshold_rms = 30
    
    def upload_dataset(self, csv_path: str, name: str, overwrite: bool = True) -> str:
        import csv
        rms_values = []
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['is_clench'] == '0':
                    rms_values.append(float(row['rms']))
        
        if rms_values:
            mean = sum(rms_values) / len(rms_values)
            std = (sum((x - mean)**2 for x in rms_values) / len(rms_values)) ** 0.5
            self.threshold_rms = mean + 3 * std
        
        print(f"[MOCK] Dataset uploaded, threshold: {self.threshold_rms:.2f}")
        return "mock_dataset_123"
    
    def train_model(self, model_name: str, label_column: str = "is_clench", overwrite: bool = True) -> str:
        print("[MOCK] Model trained")
        return "mock_model_456"
    
    def wait_for_training(self, timeout: int = 300) -> bool:
        return True
    
    def upload_inference_data(self, csv_path: str, name: str) -> str:
        return "mock_infer_dataset"
    
    def predict(self, inference_dataset_id: str) -> Dict:
        return {"predictions": []}
    
    def detect_single(self, features: Dict[str, float]) -> Dict[str, Any]:
        """For real-time single-sample detection."""
        rms = features.get('rms', 0)
        if rms > self.threshold_rms:
            conf = min(1.0, (rms - self.threshold_rms) / self.threshold_rms)
            return {"is_clench": True, "confidence": conf}
        return {"is_clench": False, "confidence": 0.0}


def get_client(use_mock: bool = True):
    if use_mock:
        return MockWoodWideClient()
    return WoodWideClient()