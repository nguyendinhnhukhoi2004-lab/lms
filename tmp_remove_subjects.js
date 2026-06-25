const fs = require('fs');

let seed = fs.readFileSync('database/seed_full.sql', 'utf8');

const linesToRemove = [
  'Giáo dục thể chất',
  'Giáo dục quốc phòng và an ninh',
  'Hoạt động trải nghiệm, hướng nghiệp',
  'Nội dung giáo dục địa phương',
  'Âm nhạc',
  'Mĩ thuật',
  'Tiếng dân tộc thiểu số',
  'Ngoại ngữ 2'
];

let newLines = [];
let inSubjects = false;

const rows = seed.split('\n');
for (let i = 0; i < rows.length; i++) {
  const line = rows[i];
  
  if (line.includes('INSERT INTO subjects')) {
    inSubjects = true;
    newLines.push(line);
    continue;
  }
  
  if (inSubjects && line.trim() === '') {
    inSubjects = false;
    newLines.push(line);
    continue;
  }
  
  if (inSubjects && line.includes('(')) {
    let shouldRemove = false;
    for (const word of linesToRemove) {
      if (line.includes(word)) {
        shouldRemove = true;
        break;
      }
    }
    if (!shouldRemove) {
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

// fix the trailing comma of the last subject insert
for (let i = 0; i < newLines.length; i++) {
  if (newLines[i].includes('INSERT INTO subjects')) {
    let lastSubjectIdx = -1;
    for (let j = i + 1; j < newLines.length; j++) {
      if (newLines[j].trim() === '') break;
      if (newLines[j].includes('(')) {
        lastSubjectIdx = j;
      }
    }
    if (lastSubjectIdx !== -1) {
      if (newLines[lastSubjectIdx].endsWith(',')) {
        newLines[lastSubjectIdx] = newLines[lastSubjectIdx].slice(0, -1) + ';';
      }
    }
    break;
  }
}

fs.writeFileSync('database/seed_full.sql', newLines.join('\n'), 'utf8');
console.log("Removed non-exam subjects");
