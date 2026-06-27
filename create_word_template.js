const fs = require('fs');
const { Document, Paragraph, TextRun, HeadingLevel, Packer } = require('docx');

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: "HƯỚNG DẪN SỬ DỤNG FILE IMPORT CÂU HỎI", heading: HeadingLevel.HEADING_1 }),
        new Paragraph("======================================="),
        new Paragraph("Mỗi câu hỏi bắt đầu bằng \"Câu N:\" kèm [LOẠI] [ĐỘ_KHÓ]"),
        new Paragraph(""),
        new Paragraph("LOẠI CÂU:   [MCQ] = Trắc nghiệm  |  [DS] = Đúng/Sai  |  [TLN] = Trả lời ngắn  |  [TL] = Tự luận"),
        new Paragraph("ĐỘ KHÓ:     [NB] = Biết  |  [TH] = Hiểu  |  [VD] = Vận dụng"),
        new Paragraph("═══════════════════════════════════════════════════════"),
        new Paragraph(""),
        new Paragraph("Câu 1: [MCQ] [NB]"),
        new Paragraph("Mệnh đề toán học nào sau đây là mệnh đề sai?"),
        new Paragraph("A. Số 2 là số nguyên tố."),
        new Paragraph("B. Số 2 là số hữu tỉ."),
        new Paragraph("C. Số 2 là số hữu tỉ dương."),
        new Paragraph("D. Số 2 không là số nguyên tố."),
        new Paragraph("Đáp án: D"),
        new Paragraph(""),
        new Paragraph("Câu 2: [MCQ] [TH]"),
        new Paragraph("Nội dung câu hỏi trắc nghiệm?"),
        new Paragraph("A. Lựa chọn A"),
        new Paragraph("B. Lựa chọn B"),
        new Paragraph("C. Lựa chọn C"),
        new Paragraph("D. Lựa chọn D"),
        new Paragraph("Đáp án: B"),
        new Paragraph(""),
        new Paragraph("Câu 3: [DS] [TH]"),
        new Paragraph("Cho tam giác ABC vuông tại A có AB = 3, AC = 4."),
        new Paragraph("a) [1,NB] BC = 5."),
        new Paragraph("b) [1,NB] Diện tích tam giác bằng 6."),
        new Paragraph("c) [2,TH] Sin(B) = 4/5."),
        new Paragraph("d) [2,VD] Đường cao từ A xuống BC có độ dài 12/5."),
        new Paragraph("Đáp án: T,T,T,T"),
        new Paragraph(""),
        new Paragraph("Câu 4: [TLN] [VD]"),
        new Paragraph("Cho hình chữ nhật ABCD có AB = 6, BC = 8. Độ dài đường chéo AC bằng bao nhiêu?"),
        new Paragraph("Đáp án: 10, 10 đơn vị"),
        new Paragraph(""),
        new Paragraph("Câu 5: [TL] [VD]"),
        new Paragraph("Trình bày định luật bảo toàn động lượng và nêu 2 ứng dụng thực tế."),
        new Paragraph("Từ khóa: hệ kín, động lượng, bảo toàn, ngoại lực, tổng động lượng"),
        new Paragraph("Đáp án mẫu: Trong một hệ kín không có ngoại lực tác dụng, tổng động lượng của hệ được bảo toàn..."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('frontend/public/template_import_cauhoi.docx', buffer);
  console.log("Word template created successfully");
});
