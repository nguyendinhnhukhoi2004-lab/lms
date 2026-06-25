const ExamModel = require('./src/models/exam.model');
(async () => {
  const result = await ExamModel.findAll({ limit: 1 });
  const examId = result.exams[0].id;
  const exam = await ExamModel.findById(examId);
  console.log(JSON.stringify(exam.questions, null, 2));
  process.exit(0);
})();
