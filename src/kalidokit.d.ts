// 이 파일은 타입스크립트에게 'kalidokit' 모듈의 존재와
// 그 안에 어떤 것들이 있는지 간단하게 알려주는 역할을 합니다.

declare module 'kalidokit' {
    // Face와 Pose의 자세한 타입을 모두 정의하기는 복잡하므로,
    // 어떤 타입이든 올 수 있다는 의미의 'any'로 간단하게 선언합니다.
    export const Face: any;
    export const Pose: any;
}