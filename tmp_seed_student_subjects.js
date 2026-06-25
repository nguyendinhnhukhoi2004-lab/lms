const fs = require('fs');

let seed = fs.readFileSync('database/seed_full.sql', 'utf8');

// Match all students
const studentRegex = /\('([a-f0-9\-]+)',\s*\$q\$.*?\$q\$,\s*'[^']+',\s*'[^']+',\s*'student',\s*'([a-f0-9\-]+)'\)/g;

let match;
const students = [];
while ((match = studentRegex.exec(seed)) !== null) {
  students.push({ id: match[1], class_id: match[2] });
}

// Map class to grade
const classRegex = /\('([a-f0-9\-]+)',\s*'([^']+)',\s*(\d+)/g;
const classes = {};
while ((match = classRegex.exec(seed)) !== null) {
  classes[match[1]] = { name: match[2], grade: parseInt(match[3]) };
}

// Get all subjects
const subjectRegex = /\('([a-f0-9\-]+)',\s*\$q\$(.*?)\$q\$,\s*(\d+),\s*'([^']+)'/g;
const subjects = {};
while ((match = subjectRegex.exec(seed)) !== null) {
  const id = match[1];
  const name = match[2].trim();
  const grade = parseInt(match[3]);
  const category = match[4];
  
  if (!subjects[grade]) subjects[grade] = [];
  subjects[grade].push({ id, name, category });
}

const batBuocNames = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Lịch sử'];
const toHopA_Names = ['Vật lý', 'Hóa học', 'Sinh học', 'Tin học'];
const toHopB_Names = ['Vật lý', 'Hóa học', 'Sinh học', 'Công nghệ'];

let inserts = [];

students.forEach((student, index) => {
  const c = classes[student.class_id];
  if (!c) return;
  const grade = c.grade;
  const gradeSubjects = subjects[grade] || [];
  
  // Choose toHop A or B based on index (even = A, odd = B) to simulate "Lớp ghép"
  const isToHopA = (index % 2 === 0);
  const mySubjects = gradeSubjects.filter(s => {
    // Check if it's a core subject
    if (batBuocNames.some(b => s.name.startsWith(b))) return true;
    // Check elective
    if (isToHopA && toHopA_Names.some(b => s.name.startsWith(b))) return true;
    if (!isToHopA && toHopB_Names.some(b => s.name.startsWith(b))) return true;
    return false;
  });
  
  mySubjects.forEach(sub => {
    inserts.push(`('${student.id}', '${sub.id}')`);
  });
});

const sql = `\n-- STUDENT SUBJECTS (TỔ HỢP MÔN)\nINSERT INTO student_subjects (student_id, subject_id) VALUES\n` + 
            inserts.join(',\n') + ';\n';

// Only append if not already there
if (!seed.includes('INSERT INTO student_subjects')) {
  seed += sql;
  fs.writeFileSync('database/seed_full.sql', seed, 'utf8');
  console.log("Appended student_subjects to seed_full.sql");
} else {
  console.log("Already appended");
}
