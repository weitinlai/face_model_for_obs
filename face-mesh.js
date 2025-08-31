class FaceMeshTracker {
    constructor() {
        this.faceMesh = null;
        this.camera = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.threeCanvas = null;
        this.threeScene = null;
        this.threeCamera = null;
        this.threeRenderer = null;
        this.faceMesh3D = null;
        this.landmarks = [];
        this.is3DMode = false;
        this.isTracking = false;
        this.fpsCounter = 0;
        this.lastTime = 0;
        
        this.settings = {
            opacity: 0.8,
            meshColor: '#00ff88',
            lineWidth: 1,
            sensitivity: 0.5,
            showLandmarks: true,
            showMesh: true,
            smoothTracking: true
        };
        
        this.init();
    }

    async init() {
        try {
            await this.setupMediaPipe();
            this.setupThreeJS();
            this.setupCamera();
            this.setupControls();
            this.setupEventListeners();
            this.animate();
            this.updateStatus('已連接', true);
        } catch (error) {
            console.error('初始化失敗:', error);
            this.updateStatus('初始化失敗', false);
        }
    }

    async setupMediaPipe() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            this.onFaceMeshResults(results);
        });
    }

    setupThreeJS() {
        this.threeCanvas = document.getElementById('threeCanvas');
        
        // 創建場景
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x000000);
        
        // 創建相機
        this.threeCamera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.threeCamera.position.z = 5;
        
        // 創建渲染器
        this.threeRenderer = new THREE.WebGLRenderer({ 
            canvas: this.threeCanvas, 
            alpha: true,
            antialias: true 
        });
        this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
        this.threeRenderer.setPixelRatio(window.devicePixelRatio);
        
        // 創建面部網格
        this.createFaceMesh3D();
        
        // 添加燈光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.threeScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.threeScene.add(directionalLight);
    }

    createFaceMesh3D() {
        // 創建面部網格幾何體
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        
        // 簡化的面部網格（實際使用時會根據MediaPipe的468個點來創建）
        for (let i = 0; i < 468; i++) {
            vertices.push(0, 0, 0);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        // 創建材質
        const material = new THREE.MeshBasicMaterial({
            color: this.settings.meshColor,
            transparent: true,
            opacity: this.settings.opacity,
            wireframe: true
        });
        
        this.faceMesh3D = new THREE.Mesh(geometry, material);
        this.threeScene.add(this.faceMesh3D);
    }

    async setupCamera() {
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('canvasElement');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            this.videoElement.srcObject = stream;
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.faceMesh) {
                        await this.faceMesh.send({ image: this.videoElement });
                    }
                },
                width: 1280,
                height: 720
            });
            
            this.camera.start();
            this.isTracking = true;
        } catch (error) {
            console.error('相機訪問失敗:', error);
            this.updateStatus('相機訪問失敗', false);
        }
    }

    setupControls() {
        // 透明度控制
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        
        opacitySlider.addEventListener('input', (e) => {
            this.settings.opacity = parseFloat(e.target.value);
            opacityValue.textContent = this.settings.opacity.toFixed(1);
            if (this.faceMesh3D) {
                this.faceMesh3D.material.opacity = this.settings.opacity;
            }
        });

        // 網格顏色控制
        const meshColor = document.getElementById('meshColor');
        meshColor.addEventListener('change', (e) => {
            this.settings.meshColor = e.target.value;
            if (this.faceMesh3D) {
                this.faceMesh3D.material.color.setHex(parseInt(this.settings.meshColor.replace('#', ''), 16));
            }
        });

        // 線條寬度控制
        const lineWidthSlider = document.getElementById('lineWidthSlider');
        const lineWidthValue = document.getElementById('lineWidthValue');
        
        lineWidthSlider.addEventListener('input', (e) => {
            this.settings.lineWidth = parseFloat(e.target.value);
            lineWidthValue.textContent = this.settings.lineWidth.toFixed(1);
        });

        // 靈敏度控制
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        const sensitivityValue = document.getElementById('sensitivityValue');
        
        sensitivitySlider.addEventListener('input', (e) => {
            this.settings.sensitivity = parseFloat(e.target.value);
            sensitivityValue.textContent = this.settings.sensitivity.toFixed(1);
        });

        // 顯示選項
        document.getElementById('showLandmarks').addEventListener('change', (e) => {
            this.settings.showLandmarks = e.target.checked;
        });

        document.getElementById('showMesh').addEventListener('change', (e) => {
            this.settings.showMesh = e.target.checked;
        });

        document.getElementById('smoothTracking').addEventListener('change', (e) => {
            this.settings.smoothTracking = e.target.checked;
        });

        // 按鈕控制
        document.getElementById('toggleMode').addEventListener('click', () => {
            this.toggle3DMode();
        });

        document.getElementById('resetCamera').addEventListener('click', () => {
            this.resetCamera();
        });

        document.getElementById('fullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });

        // 隱藏控制面板的快捷鍵
        document.addEventListener('keydown', (e) => {
            if (e.key === 'h' || e.key === 'H') {
                this.toggleControls();
            }
        });
    }

    onFaceMeshResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            this.landmarks = landmarks;
            
            if (this.is3DMode) {
                this.update3DFaceMesh(landmarks);
            } else {
                this.draw2DFaceMesh(landmarks);
            }
        }
    }

    draw2DFaceMesh(landmarks) {
        if (!this.settings.showMesh) return;
        
        const canvas = this.canvasElement;
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 繪製面部網格
        ctx.strokeStyle = this.settings.meshColor;
        ctx.lineWidth = this.settings.lineWidth;
        ctx.globalAlpha = this.settings.opacity;
        
        // 繪製網格線條
        this.drawFaceMeshLines(ctx, landmarks);
        
        // 繪製面部特徵點
        if (this.settings.showLandmarks) {
            this.drawLandmarks(ctx, landmarks);
        }
    }

    drawFaceMeshLines(ctx, landmarks) {
        // 定義面部網格的連接線
        const connections = [
            // 臉部輪廓
            [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
            // 左眼
            [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [133, 173], [173, 157], [157, 158], [158, 159], [159, 160], [160, 161], [161, 246], [246, 33],
            // 右眼
            [362, 382], [382, 381], [381, 380], [380, 374], [374, 373], [373, 390], [390, 249], [249, 263], [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362],
            // 鼻子
            [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 168], [168, 8], [8, 9], [9, 10], [10, 151], [151, 337], [337, 338], [338, 339], [339, 340], [340, 341], [341, 342], [342, 343], [343, 344], [344, 345], [345, 346], [346, 347], [347, 348], [348, 349], [349, 350], [350, 351], [351, 352], [352, 353], [353, 354], [354, 355], [355, 356], [356, 357], [357, 358], [358, 359], [359, 360], [360, 361], [361, 362], [362, 363], [363, 364], [364, 365], [365, 366], [366, 367], [367, 368], [368, 369], [369, 370], [370, 371], [371, 372], [372, 373], [373, 374], [374, 375], [375, 376], [376, 377], [377, 378], [378, 379], [379, 380], [380, 381], [381, 382], [382, 383], [383, 384], [384, 385], [385, 386], [386, 387], [387, 388], [388, 389], [389, 390], [390, 391], [391, 392], [392, 393], [393, 394], [394, 395], [395, 396], [396, 397], [397, 398], [398, 399], [399, 400], [400, 401], [401, 402], [402, 403], [403, 404], [404, 405], [405, 406], [406, 407], [407, 408], [408, 409], [409, 410], [410, 411], [411, 412], [412, 413], [413, 414], [414, 415], [415, 416], [416, 417], [417, 418], [418, 419], [419, 420], [420, 421], [421, 422], [422, 423], [423, 424], [424, 425], [425, 426], [426, 427], [427, 428], [428, 429], [429, 430], [430, 431], [431, 432], [432, 433], [433, 434], [434, 435], [435, 436], [436, 437], [437, 438], [438, 439], [439, 440], [440, 441], [441, 442], [442, 443], [443, 444], [444, 445], [445, 446], [446, 447], [447, 448], [448, 449], [449, 450], [450, 451], [451, 452], [452, 453], [453, 454], [454, 455], [455, 456], [456, 457], [457, 458], [458, 459], [459, 460], [460, 461], [461, 462], [462, 463], [463, 464], [464, 465], [465, 466], [466, 467], [467, 468], [468, 1]
        ];

        ctx.beginPath();
        connections.forEach(([start, end]) => {
            if (landmarks[start] && landmarks[end]) {
                const startX = landmarks[start].x * canvas.width;
                const startY = landmarks[start].y * canvas.height;
                const endX = landmarks[end].x * canvas.width;
                const endY = landmarks[end].y * canvas.height;
                
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
            }
        });
        ctx.stroke();
    }

    drawLandmarks(ctx, landmarks) {
        ctx.fillStyle = this.settings.meshColor;
        ctx.globalAlpha = 1;
        
        landmarks.forEach(landmark => {
            const x = landmark.x * ctx.canvas.width;
            const y = landmark.y * ctx.canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    update3DFaceMesh(landmarks) {
        if (!this.faceMesh3D || !this.settings.showMesh) return;
        
        // 更新3D網格頂點位置
        const positions = this.faceMesh3D.geometry.attributes.position.array;
        
        landmarks.forEach((landmark, index) => {
            if (index * 3 + 2 < positions.length) {
                // 將2D座標轉換為3D座標
                const x = (landmark.x - 0.5) * 10;
                const y = (0.5 - landmark.y) * 10;
                const z = landmark.z * 5;
                
                positions[index * 3] = x;
                positions[index * 3 + 1] = y;
                positions[index * 3 + 2] = z;
            }
        });
        
        this.faceMesh3D.geometry.attributes.position.needsUpdate = true;
        
        // 根據面部表情調整網格
        this.adjustMeshForExpression(landmarks);
    }

    adjustMeshForExpression(landmarks) {
        // 檢測面部表情並調整網格
        if (this.faceMesh3D) {
            // 根據眼睛開合程度調整
            const leftEyeOpen = this.calculateEyeOpenness(landmarks, 'left');
            const rightEyeOpen = this.calculateEyeOpenness(landmarks, 'right');
            
            // 根據嘴巴開合程度調整
            const mouthOpen = this.calculateMouthOpenness(landmarks);
            
            // 應用表情變化
            this.faceMesh3D.scale.setScalar(1 + mouthOpen * 0.1);
        }
    }

    calculateEyeOpenness(landmarks, eye) {
        // 簡化的眼睛開合度計算
        const eyeIndices = eye === 'left' ? [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246] : [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
        
        let maxY = -Infinity;
        let minY = Infinity;
        
        eyeIndices.forEach(index => {
            if (landmarks[index]) {
                maxY = Math.max(maxY, landmarks[index].y);
                minY = Math.min(minY, landmarks[index].y);
            }
        });
        
        return Math.max(0, (maxY - minY) * 10);
    }

    calculateMouthOpenness(landmarks) {
        // 簡化的嘴巴開合度計算
        const mouthIndices = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 462, 463, 464, 465, 466, 467, 468];
        
        let maxY = -Infinity;
        let minY = Infinity;
        
        mouthIndices.forEach(index => {
            if (landmarks[index]) {
                maxY = Math.max(maxY, landmarks[index].y);
                minY = Math.min(minY, landmarks[index].y);
            }
        });
        
        return Math.max(0, (maxY - minY) * 5);
    }

    toggle3DMode() {
        this.is3DMode = !this.is3DMode;
        const button = document.getElementById('toggleMode');
        
        if (this.is3DMode) {
            button.textContent = '切換到2D模式';
            this.canvasElement.style.display = 'none';
            this.threeCanvas.style.display = 'block';
        } else {
            button.textContent = '切換到3D模式';
            this.canvasElement.style.display = 'block';
            this.threeCanvas.style.display = 'none';
        }
    }

    resetCamera() {
        if (this.camera) {
            this.camera.stop();
            this.setupCamera();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    toggleControls() {
        const controls = document.getElementById('controls');
        controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
    }

    onWindowResize() {
        if (this.threeRenderer) {
            this.threeCamera.aspect = window.innerWidth / window.innerHeight;
            this.threeCamera.updateProjectionMatrix();
            this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.canvasElement) {
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
        }
    }

    updateStatus(text, isConnected) {
        const statusText = document.getElementById('statusText');
        const statusIndicator = document.getElementById('statusIndicator');
        
        statusText.textContent = text;
        statusIndicator.className = `status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 更新FPS計數器
        this.fpsCounter++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            document.getElementById('fpsValue').textContent = this.fpsCounter;
            this.fpsCounter = 0;
            this.lastTime = currentTime;
        }
        
        // 渲染3D場景
        if (this.is3DMode && this.threeRenderer && this.threeScene && this.threeCamera) {
            this.threeRenderer.render(this.threeScene, this.threeCamera);
        }
    }
}

// 當頁面加載完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    new FaceMeshTracker();
});

// 導出類別供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceMeshTracker;
}

