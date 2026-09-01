## 변경 요약


## 체크리스트
- [ ] 모바일 뷰포트(320/390/430) 확인
- [ ] 절대 규칙 준수
  - [ ] 1. 데이터 접근은 lib/data.ts 경유
  - [ ] 2. 네이버·카카오 API 응답 저장 없음
  - [ ] 3. 외부 이미지 도메인 미사용
  - [ ] 4. localStorage/sessionStorage 미사용
  - [ ] 5. 시크릿 하드코딩 없음
  - [ ] 6. dangerouslySetInnerHTML 미사용
  - [ ] 7. 서버 전용 키 클라이언트 미노출
- [ ] 4상태(로딩/빈/에러/정상) 해당 시 구현
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 통과
