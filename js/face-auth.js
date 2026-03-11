/* ================================================================
   FACE AUTHENTICATION MODULE
   Bao gồm các hàm tải model, mở camera, trích xuất đặc trưng
   và so sánh khuôn mặt (Euclidean distance).
   ================================================================ */

const FACE_MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
let modelsLoaded = false;

/**
 * Tải các model cần thiết của face-api
 */
async function loadFaceModels() {
    if (modelsLoaded) return true;
    try {
        // Sử dụng tinyFaceDetector thay vì ssdMobilenetv1 để tối ưu & không đơ máy
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL)
        ]);
        modelsLoaded = true;
        return true;
    } catch (err) {
        console.error('Lỗi khi tải Face Models:', err);
        return false;
    }
}

/**
 * Mở WebCam và gán luồng video vào thẻ <video>
 */
async function startCamera(videoElement) {
    try {
        // Giới hạn độ phân giải để giảm tải CPU/GPU
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 480 },
                height: { ideal: 360 }
            }
        });
        videoElement.srcObject = stream;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve(true); // Camera sẵn sàng
            };
        });
    } catch (err) {
        console.error('Không thể truy cập camera:', err);
        return false;
    }
}

/**
 * Tắt WebCam
 */
function stopCamera(videoElement) {
    if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
}

/**
 * Trích xuất khuôn mặt từ thẻ video hiện tại
 * Trả về descriptor (Float32Array) hoặc null nếu không thấy ai
 */
async function extractFaceDescriptor(videoElement) {
    if (!modelsLoaded) {
        const loaded = await loadFaceModels();
        if (!loaded) throw new Error("Models not loaded");
    }

    // Phát hiện 1 khuôn mặt bằng Tiny Face Detector siêu nhẹ
    const detection = await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        // console.log("=> Không tìm thấy khuôn mặt rõ nét trong khung hình.");
        return null;
    }

    console.log("====================================================");
    console.log("✅ ĐÃ TRÍCH XUẤT THÀNH CÔNG FACE DESCRIPTOR TỪ WEBCAM");
    console.log("Bạn có thể copy mảng dưới đây để paste thủ công vào cột face_descriptor trên Supabase:");
    console.log(JSON.stringify(Array.from(detection.descriptor)));
    console.log("====================================================");

    return detection.descriptor; // Mảng 128 số
}

/**
 * So sánh 2 descriptor. Trả về true nếu khoảng cách (Euclidean) <= 0.5 (Ngưỡng an toàn hợp lý)
 */
function isMatch(descriptor1, descriptor2, threshold = 0.5) {
    if (!descriptor1 || !descriptor2) return false;

    // faceapi.euclideanDistance nhận vào Float32Array hoặc mảng JS
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    // console.log("Face Distance:", distance);
    return distance <= threshold;
}
