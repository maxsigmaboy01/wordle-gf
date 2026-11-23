# Daily Puzzle V3 — Hint System Specification (TH + Dev Handoff)

## จุดประสงค์
เกม Wordle-inspired สำหรับ macOS (Rust/Tauri v2 + HTML/CSS/JS) มี 8 ธีม พร้อมคำใบ้ช่วยให้คนที่เพิ่งเริ่มเล่นไม่ติดทางตัน
- UI ปุ่ม Hint อยู่ที่หัวกระดานและใน sidebar/pill ระหว่างเล่น
- ใช้ token รูปดาว ⭐ เท่านั้น ไม่ใช้เงินจริงและไม่ใช่ระบบซื้อในแอป
- ค่าเริ่มต้น: 3 ดาวต่อชุดเล่น 5 level; ชนะ 1 level รับคืน 1 ดาว สูงสุด 5 ดาว
- ไม่เสียโอกาสทายเมื่อใช้ hint; กด 'Use hint' เท่านั้นจึงหักดาว
- State ของ hint ถูกเก็บใน `settings.game.hints` ผ่าน localStorage ร่วมกับสถานะเกม; restart app แล้วยังอยู่
- Modal ให้เลือกประเภทก่อน โดยยังไม่หักดาว; hint ไม่พร้อมใช้งานจะ disabled

## ประเภท Hint

### 1. Letter Peek (1 ดาว)
- ตัวอย่าง: `Contains the letter A`
- เปิดเผย 1 ตัวอักษรที่อยู่ในคำเฉลย แต่ไม่บอกตำแหน่ง
- ไม่เติมคำลงช่องทายให้เอง
- ใน Normal Mode ดึงจาก fixed target
- ใน Surprise Mode ดึงจาก candidate set ที่ยังสอดคล้องกับคำใบ้เก่าแล้วคัดกรองเหลือเฉพาะ candidate ที่มีตัวอักษรนั้น

### 2. Position Lock (2 ดาว)
- ตัวอย่าง: `Slot 3 is A`
- เปิดเผยอักษรพร้อมตำแหน่ง (ช่อง 1-5)
- แสดงเป็น clue pill เหนือคีย์บอร์ด; ไม่ auto-submit และไม่ใช้โอกาสทาย
- หลีกเลี่ยงเปิดตำแหน่งเดียวกันซ้ำ
- ใน Surprise Mode ต้องเหลือ candidate อย่างน้อย 2 คำหลังล็อก มิฉะนั้นไม่เปิด hint นั้น

### 3. Eliminate 3 (1 ดาว)
- ตัวอย่าง: `No Q / X / Z`
- เลือกอักษร 3 ตัวที่ไม่มีในคำเฉลย; ในคีย์บอร์ดทำจาง/ขีดฆ่า
- หากพิมพ์คำที่มีตัวที่ถูกกำจัดจะไม่รับคำและแจ้งเตือน ไม่หักครั้งทาย
- ไม่เอาอักษรที่ผู้เล่นทายไปแล้วมาเป็นคำใบ้ซ้ำ
- ใน Surprise Mode จำกัดให้หลังใช้ hint ต้องเหลือ candidate อย่างน้อย 2 คำ และใช้สีคำทายบน candidate ชุดนั้นต่อ

## การคิดดาว
- เริ่มด่านแรก 3 ดาว; hint cost 1/2/1 ตามด้านบน
- `tokens` อยู่ใน game state; วงเงินใช้ร่วม 5 level
- หากชนะ level 1-4 ปุ่ม 'Next Level' ให้ +1 ดาว (max 5)
- ปิด Hint ใน Settings > General ให้กดไม่ได้ทันที (ไม่มีการหักดาวย้อนหลัง)
- เมื่อดาวไม่พอ: disable card พร้อมข้อความ 'unavailable'; ไม่มีลบดาวติดลบ

## Modal states
1. Idle: 3 cards ให้เลือก, หัวข้อ 'Need a little nudge?', ตัวยอดดาว
2. Selected: card มีกรอบสีทอง, ปุ่ม 'Use Letter Peek / Position Lock / Eliminate 3'
3. Confirmed: modal ปิด, ดาวลด, clue pill แสดงชัด, SFX ชนะเล็ก ๆ
4. Not enough stars: card disabled
5. Hint cannot be safely derived: card disabled, ไม่หักดาว
6. Game finished: ปิดปุ่ม Hint และไม่แก้ hint history
7. Reload: ค่าที่ใช้และรายการ hint ต้องกลับมาเหมือนเดิม
8. Accessibility: keyboard focus, aria, reduced-motion CSS, ไม่อาศัยสีเพียงอย่างเดียว

## Surprise Mode — Guardrails
- ปิดโดยค่าเริ่มต้น. เปิดจาก Creator Settings เท่านั้น
- Surprise Mode ใช้ candidate set แทน fixed target เพื่อให้ผู้เล่นไม่มีทางชนะปกติ
- ข้อมูล Letter/Position/Excluded ต้องกรอง candidate set ที่เหลืออยู่เพื่อไม่ขัดแย้งโดยตรง
- ระบบ adversarial ปัจจุบันยังเป็น **best-effort prototype** บน wordlist จำนวนจำกัด: บางเส้นทางที่ candidate เหลือ 1 คำอาจไม่สามารถให้ทั้งผล 'ไม่มีวันชนะ' และ 'คำใบ้สมเหตุสมผล 100%' พร้อมกันได้
- Production recommendation: (1) precompute adversarial branches จาก full dictionary และ hints หรือ (2) disable advanced hints อย่างมี UX ที่ไม่เผยสปอยล์ใน build แยกผู้เล่น; QA ต้องทดสอบกรณี candidate หมด
- สถิติ Surprise Mode ไม่ปนกับชัยชนะปกติ
- Creator mode และข้อความลับอยู่ใน client prototype; ไม่มีความลับทาง cryptography หากใคร inspect app bundle. ทำ recipient-only build เมื่อต้องการซ่อนจริง

## Testing / Acceptance Criteria
- คำทายไม่ครบ/ไม่อยู่ในพจนานุกรม/คำซ้ำ ไม่กินครั้ง
- Hint ไม่กินครั้ง; ค่าใช้ดาวถูกต้อง; ปุ่มยืนยันถึงจะจ่าย
- ก่อนและหลัง reload สถานะ clue, token, tile, guess state คงเดิม
- Normal Mode ทุกคำใบ้ถูกต้องตาม target
- No duplicate clue ที่เคยใช้; eliminate ไม่ทำให้ valid target เป็นไปไม่ได้
- Surprise: six valid guesses -> reveal custom six rows; คำใบ้พยายามสอดคล้องกับ prior candidate
- ด้วย reduced-motion, หยุด animation ที่ไม่จำเป็น
- 8 ธีมใช้กติกาเดียวกันและเปลี่ยนธีมแล้ว game state ไม่สูญหาย

## ข้อมูลที่ UI เก็บ
`game = {level: 1..5, tokens: 0..5, hints: {peek: string[], locks: { [pos]: letter }, excluded: string[], history: {kind, detail, cost}[]}, ...}`

Notes: UI prototype นี้ทำจาก JS. Logic สามารถย้ายไปเป็น Rust command ใน Tauri ภายหลัง โดยรักษา model เดิมหรือ migrate storage schema.
