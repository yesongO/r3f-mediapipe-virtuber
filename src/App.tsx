// App.tsx

import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Face } from 'kalidokit';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './App.css';

const remap = (val: number, min: number, max: number) => {
    return Math.max(Math.min(val, max), min);
};

// 표정 목록
const expressions = ["Neutral", "Angry", "Fun", "Joy", "Sorrow", "Surprised"];

// VRoid 모델(아바타) 컴포넌트
function VroidAvatar({ rig, blendshapes, expression,...props }: { rig: any; blendshapes: any[], expression: string, [key: string]: any }) {
  const { scene, nodes } = useGLTF('/song_clone.glb');

  useEffect(() => {
    console.log(nodes);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.frustumCulled = false;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              mat.depthWrite = true;
            });
          } else {
              mesh.material.depthWrite = true;
          }
        }
      });
  }, [scene]);
  
  // 🦴 얼굴 움직일 뼈대, 팔을 내리기 위한 뼈대
  const { 
    J_Bip_C_Head: Head, 
    J_Bip_C_Neck: Neck,
    J_Bip_L_UpperArm: LeftUpperArm,
    J_Bip_R_UpperArm: RightUpperArm,
  } = nodes;

  useEffect(() => {
    if (LeftUpperArm && RightUpperArm) {
      LeftUpperArm.rotation.z = -0.7;
      RightUpperArm.rotation.z = 1;
    }
  }, [LeftUpperArm, RightUpperArm]);

  // 😀 표정 조정할 얼굴 메쉬
  const faceMesh = scene.getObjectByName('Face_(merged)') as THREE.SkinnedMesh;

  useEffect(() => {
    if (faceMesh) {
        console.log("✔️ 아바타의 얼굴요소 목록 확인:", faceMesh.morphTargetDictionary);
    }
  }, [faceMesh]);

  useFrame(() => {
    if (!rig) return;

    // 머리 움직임
    const headEuler = new THREE.Euler(remap(rig.head.x * -1, -0.4, 0.4), remap(rig.head.y, -0.4, 0.4), remap(rig.head.z, -0.4, 0.4));
    const headQuat = new THREE.Quaternion().setFromEuler(headEuler);
    if (Head) Head.quaternion.slerp(headQuat, 0.6);
    if (Neck) Neck.quaternion.slerp(headQuat, 0.4);

    // 표정 움직임 (눈, 입)
    if (blendshapes.length > 0) { 
      const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
      const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

      // 눈을 감았다고 판단하는 기준선
      const blinkThreshold = 0.4;

      scene.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh && (obj as THREE.SkinnedMesh).morphTargetDictionary){
          const mesh = obj as THREE.SkinnedMesh;

          const blinkLeftIndex = mesh.morphTargetDictionary!['Fcl_EYE_Close_L'];
          const blinkRightIndex = mesh.morphTargetDictionary!['Fcl_EYE_Close_R'];

          // 👀 눈깜박임 기준을 넘었을 때는 1, 아니면 0으로 설정
          if (blinkLeftIndex !== undefined) {
            mesh.morphTargetInfluences![blinkLeftIndex] = eyeBlinkLeft > blinkThreshold ? 1 : 0;
          }

          if (blinkRightIndex !== undefined) {
            mesh.morphTargetInfluences![blinkRightIndex] = eyeBlinkRight > blinkThreshold ? 1 : 0;
          }

          // 👄 입모양 관련 스위치 코드, 모든 표정 스위치를 0으로 리셋하기
          for (const exp of expressions) {
            const index = mesh.morphTargetDictionary![`Fcl_MTH_${exp}`];
            if (index !== undefined) {
              mesh.morphTargetInfluences![index] = 0;
            }
          }
          // 현재 선택된 표정 스위치를 1로 키기
          const currentExpression = mesh.morphTargetDictionary![`Fcl_MTH_${expression}`];
          if (currentExpression !== undefined) {
            mesh.morphTargetInfluences![currentExpression] = 1;
          }
        }
      })
    }
  });

  return (
      <RigidBody
          {...props}
          colliders={false}
          type="kinematicPosition"
          enabledRotations={[false, true, false]} >
          <CapsuleCollider args={[0.7, 0.4]} position={[0, 1.1, 0]} />
          <primitive object={scene} position={[0, -0.85, 0]} />
      </RigidBody>
  );
}


// --- 메인 앱 컴포넌트 ---
export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [rig, setRig] = useState<any>(null);
  const [blendshapes, setBlendshapes] = useState<any[]>([]);

  const [expression, setExpression] = useState<string>("Neutral");

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);

  useEffect(() => {
    async function setupMediapipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
        const faceOptions = {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
          outputFaceBlendshapes: true, 
          runningMode: "VIDEO", 
          numFaces: 1
        } as const;
          
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, faceOptions);
        setLoading(false);
      } catch (error) {
          console.error("Mediapipe 초기화 실패:", error);
      }
    }
    setupMediapipe();
  }, []);

  const startWebcam = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current!.play();
        setWebcamStarted(true);
        predictWebcam();
      };
    } catch (error) {
      console.error("Webcam 시작 실패:", error);
    }
  };

  let lastVideoTime = -1;
  const predictWebcam = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const now = performance.now();
    
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
        
      if (faceLandmarkerRef.current) {
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
        const faceDetected = faceResult.faceLandmarks.length > 0;

        if (faceDetected) {
          const faceRig = Face.solve(faceResult.faceLandmarks[0], { runtime: "mediapipe", video });
            
          if (faceRig) {
            setRig({ ...faceRig,});
          }
          if (faceResult.faceBlendshapes.length > 0) {
            // console.log("Mediapipe가 보낸 표정 데이터:", faceResult.faceBlendshapes[0].categories);
            setBlendshapes(faceResult.faceBlendshapes[0].categories);
          }
        }
      }
    }
    requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="app-container">
      <div className="ui-container">

      </div>
        <div className="video-container">
            <video ref={videoRef} autoPlay playsInline></video>
        </div>
        <Canvas shadows camera={{ position: [0, 0.2, 0.8], fov: 30, rotation: [-0.3, 0, 0] }}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]}>
              <VroidAvatar rig={rig} blendshapes={blendshapes} expression={expression} position={[-0.13, -0.7, -0.4]} />
              <RigidBody type="fixed">
              </RigidBody>
            </Physics>

          </Suspense>
          <Environment preset="sunset" />
          {/* <OrbitControls target={[0, 0.4, 0.3]} /> */}
        </Canvas>
        <div className="stream-overlay">
          <div className="left-panel">
            <div className="info-box">
              <h1 className="stream-title">오예송의 버튜버 데뷔방송 🎉</h1>
              <p className="stream-status" style={{ color: 'white', marginBottom: '10px' }}>Made by r3f</p>
              <p className="stream-status">🔴 LIVE</p>
            </div>
            <div className="control-panel">
              <h2 className="panel-title">컨트롤 패널</h2>
              <button className="start-button" onClick={startWebcam} disabled={loading || webcamStarted}>
                {loading ? "모델 로딩 중..." : webcamStarted ? "방송 중.." : "방송 시작"}
              </button>
            </div>
            <div className="expression-panel">
              <h3 className="panel-subtitle">Emotions</h3>
              <div className="expression-buttons">
                {expressions.map((exp) => (
                  <button key={exp} onClick={() => setExpression(exp)} className={expression === exp ? "active" : ""}>
                    {exp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="chat-box">
              <div className="chat-header">
                <h3>실시간 채팅</h3>
              </div>
              <div className="chat-messages">
                <p><span>Gemini :</span> <span>예송아 안녕! 방송 너무 재밌다~</span></p>
                <p><span>React :</span> <span>와 r3f로 이런 것도 되는구나!</span></p>
                <p><span>Cursor :</span> <span>이거 완전 대박이네요 ㄷㄷ</span></p>
                <p><span>VTuber_Fan :</span> <span>아바타 너무 귀여워요! 😍</span></p>
                <p><span>Yesong_Fan :</span> <span>예송님 최고!!</span></p>
                <p><span>??? :</span> <span>제발 이런것좀 만들지 마세요..</span></p>
              </div>
            </div>
          </div>
        </div>
    </div>
    
  );
}