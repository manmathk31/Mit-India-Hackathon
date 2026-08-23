"""
Google Colab Training Script for ClaimPilot AI - Vehicle Damage Detection Model
Run this in a free Google Colab GPU (T4) notebook.
"""

# STEP 1: Install Ultralytics YOLO & Dependencies
# In Colab: !pip install ultralytics roboflow

from ultralytics import YOLO
import os

def main():
    print("=== Training Custom Vehicle Damage Detection Model ===")
    
    # 1. Load Pretrained YOLOv8/YOLOv11 Medium or Nano model
    # yolov8m is optimal for vehicle part segmentation and bounding boxes
    model = YOLO("yolov8m.pt")

    # 2. Download Car Damage Dataset from Roboflow Universe
    # Public Car Damage Datasets:
    # Option A: Car Damage Detection (Roboflow Universe - 5,000+ labeled car parts & damage)
    # Option B: Use your own annotated dataset
    
    """
    To use Roboflow dataset in Colab:
    from roboflow import Roboflow
    rf = Roboflow(api_key="YOUR_ROBOFLOW_KEY_OR_PUBLIC_URL")
    project = rf.workspace("car-damage-detection").project("car-damage-dataset")
    dataset = project.version(1).download("yolov8")
    """

    # 3. Train on GPU
    # In Colab with T4 GPU, 50 epochs takes ~12-15 minutes
    results = model.train(
        data="coco128.yaml", # Replace with dataset.location + "/data.yaml"
        epochs=30,
        imgsz=640,
        batch=16,
        name="claimpilot_damage_detector",
        device=0 # GPU
    )

    # 4. Export Model directly to ONNX (Lightweight & Fast CPU inference for production)
    onnx_path = model.export(format="onnx", dynamic=True, simplify=True)
    print(f"\n[SUCCESS] Model successfully exported to: {onnx_path}")
    print("\nDownload this file and place it at: claimcopilot/image_agent/models/damage_yolo.onnx")

if __name__ == "__main__":
    main()
