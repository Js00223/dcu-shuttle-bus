import { NFC } from "@awesome-cordova-plugins/nfc";
import { Capacitor } from "@capacitor/core";

export const useNFC = () => {
  const startScanning = () => {
    // 1. 플랫폼 확인 (안드로이드에서만 작동하게끔)
    const isAndroid = Capacitor.getPlatform() === "android";

    // 2. 브라우저 객체 확인 방식 개선 (eslint no-prototype-builtins 해결)
    const hasNfc = Object.prototype.hasOwnProperty.call(window, "nfc");

    if (isAndroid && hasNfc) {
      alert("NFC 학생증 태깅을 시작합니다. 기기 뒷면에 대주세요.");

      // 3. 타입 안정성 확보 및 리스너 등록
      NFC.addNdefListener(
        () => {
          console.log("NFC 리스너가 성공적으로 등록되었습니다.");
        },
        (err: Error) => {
          // 'err' 타입 명시 (typescript 7006 해결)
          console.error("NFC 리스너 등록 중 오류 발생:", err);
        },
      ).subscribe((event) => {
        // 4. 태그 ID 읽기
        if (event.tag && event.tag.id) {
          const tagId = NFC.bytesToHexString(event.tag.id);
          alert(`학생 인증 완료! 카드 ID: ${tagId}`);

          // 여기에 백엔드 인증 API 호출 로직 추가 예정
        }
      });
    } else {
      alert("NFC 기능을 지원하지 않는 환경입니다. (안드로이드 전용)");
    }
  };

  return { startScanning };
};
