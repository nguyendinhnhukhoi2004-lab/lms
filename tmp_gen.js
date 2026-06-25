const grades = [10, 11, 12];
const newSubjects = [
  { name: 'Giáo dục thể chất', cat: 'bat_buoc' },
  { name: 'Giáo dục quốc phòng và an ninh', cat: 'bat_buoc' },
  { name: 'Hoạt động trải nghiệm, hướng nghiệp', cat: 'bat_buoc' },
  { name: 'Nội dung giáo dục địa phương', cat: 'bat_buoc' },
  { name: 'Âm nhạc', cat: 'cong_nghe_nt' },
  { name: 'Mĩ thuật', cat: 'cong_nghe_nt' },
  { name: 'Tiếng dân tộc thiểu số', cat: 'tu_chon' },
  { name: 'Ngoại ngữ 2', cat: 'tu_chon' },
];

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  .replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, 
          v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
}

let sql = '';
grades.forEach(g => {
  newSubjects.forEach(s => {
    sql += `('${uuidv4()}', $q$${s.name} ${g}$q$, ${g}, '${s.cat}', $q$Môn ${s.name} ${g} - Chương trình GDPT 2018$q$),\n`;
  });
});
console.log(sql);
