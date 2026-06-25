const fs = require('fs');

const oldSubjects = [
  { id: '85d689d7-de6f-452d-92a7-6fb80272fb72', name: 'Toán', cat: 'bat_buoc', grades: [10, 11, 12],
    ids: ['85d689d7-de6f-452d-92a7-6fb80272fb72', '17ab1c9c-5a23-4e92-b0a6-7f43b90b57d1', '7cabb470-8e41-414c-b2a8-3db6af991139'] },
  { name: 'Ngữ văn', cat: 'bat_buoc', grades: [10, 11, 12],
    ids: ['e0e37f2e-645a-4b63-bfb9-1138027fb21f', '108b64c3-b558-471b-a17f-a8801e543998', '3a4e0a77-f516-4ffa-9840-76621b68d866'] },
  { name: 'Tiếng Anh', cat: 'bat_buoc', grades: [10, 11, 12],
    ids: ['cfe8967a-4125-4b1a-bbca-5fcb4304c595', '48eed92b-c0af-48d3-b69d-56421038600f', 'd6f516ca-026d-4f50-b909-04c4690c2bf0'] },
  { name: 'Vật lý', cat: 'khtn', grades: [10, 11, 12],
    ids: ['80a70bae-5711-4634-97a1-f6f7dc46aeff', 'eae80a37-db3e-4b7c-96c6-4ac4ac64a770', '094c3e82-4df8-4d91-acac-ecf18520fd59'] },
  { name: 'Hóa học', cat: 'khtn', grades: [10, 11, 12],
    ids: ['faf5bfd3-f5b6-4c12-8dc0-f5e30597a472', '464127a6-3564-4af0-841d-3f8806019687', '8e033478-61c4-4fd1-819d-5feb5b4c9e38'] },
  { name: 'Sinh học', cat: 'khtn', grades: [10, 11, 12],
    ids: ['34158321-547c-43ef-b6c6-9f5304011cce', '96e6699b-ac01-48fb-b8f8-add3426b8a84', 'd7e624da-a359-4fe2-86bf-0e2827898932'] },
  { name: 'Lịch sử', cat: 'bat_buoc', grades: [10, 11, 12],
    ids: ['20b3394a-dae3-407c-9e66-9f199f92994c', '3aea141a-1c64-449a-ad50-0657b9aae9e1', '496e8b80-dae2-40e1-b6e0-df81bc081385'] },
  { name: 'Địa lý', cat: 'khxh', grades: [10, 11, 12],
    ids: ['96aa9c44-11c9-41fc-a0f0-89d3eb060b49', 'd5954a9e-8506-4f5b-b327-257fa6d9839d', '4cefe059-d36f-427b-9b72-41e38b30103e'] },
  { name: 'Giáo dục kinh tế và pháp luật', cat: 'khxh', grades: [10, 11, 12],
    ids: ['a63e772a-39f3-4c64-9355-6295261006dc', '234b30b1-e0ca-48de-a772-2b1d2bdda973', '5645dbcc-cdce-49f6-9b21-7cccd4d3a409'] },
  { name: 'Tin học', cat: 'cong_nghe_nt', grades: [10, 11, 12],
    ids: ['af9f0d9c-2bd3-441e-84c5-232f5b139616', '5be1a855-f016-40bc-94e5-85621a01eae2', '49bd2404-203b-4a05-ba8e-ffe8ce536cb5'] },
  { name: 'Công nghệ', cat: 'cong_nghe_nt', grades: [10, 11, 12],
    ids: ['6132b566-82dd-4d76-9ad3-8545b3ca512e', '111269e5-3445-4b52-a6ee-a77bb6751324', '8e4199e7-adeb-478f-9c2f-4bce7f4d8e00'] },
];

const newSubjects = [
  { name: 'Giáo dục thể chất', cat: 'bat_buoc', grades: [10,11,12], ids: ['57b2f0a1-2366-4de8-8cff-cd925d60b340', '7c926d5e-41b3-4189-9ff2-0529677c0f7c', '229a4fde-1df8-47bc-9af0-96dfbe0590d7'] },
  { name: 'Giáo dục quốc phòng và an ninh', cat: 'bat_buoc', grades: [10,11,12], ids: ['ad85111b-8d7e-466c-9278-ff8aa939ade8', 'c14c2f60-6816-4156-b460-7af85f4799b1', '5ae2f36f-600b-4d4a-95b7-7d8600371db2'] },
  { name: 'Hoạt động trải nghiệm, hướng nghiệp', cat: 'bat_buoc', grades: [10,11,12], ids: ['f140bb5d-9474-49fe-8da3-22158f0360dc', '8b90ef9e-b1dc-46fc-820f-c68146530881', 'bbd012bb-dc76-4515-9006-9e86f9ae4b39'] },
  { name: 'Nội dung giáo dục địa phương', cat: 'bat_buoc', grades: [10,11,12], ids: ['66ea3df7-ce4f-4c14-a624-80e45bb9e774', '56bfde66-a93c-44f9-8648-d33dc2838027', 'cd966b37-413b-4cdc-a788-c6935e18c79b'] },
  { name: 'Âm nhạc', cat: 'cong_nghe_nt', grades: [10,11,12], ids: ['a2c399b1-6611-4ff7-8f35-13d23454af60', 'bfe39546-ef9d-4b61-bcc1-1090bef7ae93', 'e2a08306-e26c-4715-ae07-f832402a87fd'] },
  { name: 'Mĩ thuật', cat: 'cong_nghe_nt', grades: [10,11,12], ids: ['c82648d8-13e4-4a12-aca3-ced7d9affeaa', '19f9fb59-5ec4-4151-8ff3-b896ea3e15f5', '078d2240-3fba-439e-a122-2243b1d13fc5'] },
  { name: 'Tiếng dân tộc thiểu số', cat: 'tu_chon', grades: [10,11,12], ids: ['f0549768-43a7-424f-aaaf-8a743f7f7164', '39ec8ef1-9da1-4e99-918e-129ef02390ee', 'baaa25a2-678a-4db3-9612-e71e8e7f05ee'] },
  { name: 'Ngoại ngữ 2', cat: 'tu_chon', grades: [10,11,12], ids: ['06f1c244-9f64-4a72-a282-7ba736238533', '95fdb213-06b1-4884-ad33-4562fce9377c', 'aa745eac-11b6-4b1d-a2e0-4a85fc615825'] }
];

const allSubjects = [...oldSubjects, ...newSubjects];

let sql = "INSERT INTO subjects (id, name, grade, category, description) VALUES\n";
const lines = [];

allSubjects.forEach(subj => {
  subj.grades.forEach((g, idx) => {
    lines.push(`('${subj.ids[idx]}', $q$${subj.name} ${g}$q$, ${g}, '${subj.cat}', $q$Môn ${subj.name} ${g} - Chương trình GDPT 2018$q$)`);
  });
});

const insertText = sql + lines.join(',\n') + ';\n\n';

let seed = fs.readFileSync('database/seed_full.sql', 'utf8');

// Regex to replace the corrupted block
const regex = /(?:﻿)?INSERT INTO subjects \(id, name, grade, (?:category, )?description\) VALUES[\s\S]*?(?=-- LỚP HỌC)/;
seed = seed.replace(regex, insertText);

// Also we should update Giáo dục công dân -> Giáo dục kinh tế và pháp luật in head_subjects mapping
seed = seed.replace(/\$q\$Giáo dục công dân\$q\$/g, '$q$Giáo dục kinh tế và pháp luật$q$');
// and fix corrupted "Gi├ío dß╗Ñc c├┤ng d├ón" if it got messed up (since I read/wrote the whole file incorrectly last time, let's just make sure all of the file is correct).

// Wait, the file is corrupted. We'd better just fix the whole file by reverting it. 
// Instead of reverting, I will write the content of lines 14-88 correctly and replace it.
