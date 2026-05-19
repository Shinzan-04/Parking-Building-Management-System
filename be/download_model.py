"""
Script tải model YOLOv8n và export sang ONNX cho dự án Parking System.
Chạy 1 lần duy nhất để tạo file model.

Yêu cầu: pip install ultralytics

Cách chạy:
    python download_model.py
"""

from ultralytics import YOLO
import shutil
import os

# Tải model YOLOv8n pre-trained (COCO dataset - có class "car" sẵn)
print("📥 Đang tải YOLOv8n pre-trained...")
model = YOLO("yolov8n.pt")

# Export sang ONNX format
print("🔄 Đang export sang ONNX...")
model.export(format="onnx", imgsz=640, simplify=True)

# Di chuyển file ONNX vào thư mục Models
output_dir = os.path.join(os.path.dirname(__file__), "ParkingSystem.API", "Models")
os.makedirs(output_dir, exist_ok=True)

src = "yolov8n.onnx"
dst = os.path.join(output_dir, "yolov8n.onnx")

if os.path.exists(src):
    shutil.move(src, dst)
    print(f"✅ Model đã được lưu tại: {dst}")
    print(f"📦 Kích thước: {os.path.getsize(dst) / (1024*1024):.1f} MB")
else:
    print("❌ Không tìm thấy file ONNX. Kiểm tra lại quá trình export.")

# Cleanup
if os.path.exists("yolov8n.pt"):
    os.remove("yolov8n.pt")
    print("🧹 Đã dọn file .pt tạm")

print("\n🎉 Hoàn tất! Bạn có thể chạy dotnet run ngay bây giờ.")
