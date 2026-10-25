import fs from 'node:fs';

const students = JSON.parse(fs.readFileSync('/home/ubuntu/upload/first_year_students.json', 'utf8'));
const teachers = [
  { name: 'Dr. Randhir Singh', email: 'rsingh@gndec.ac.in', department: 'Applied Science', subject: 'physics' },
  { name: 'test', email: 'luckys0146@gmail.com', department: null, subject: null },
  { name: 'Neeraj Kumar', email: 'neerajkumar735561@gmail.com', department: 'Applied Science', subject: 'Mathematics' },
];

const sqlString = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const normalizedStudents = students.map((student) => ({
  email: String(student.email).trim().toLowerCase(),
  name: student.name,
  crn: student.crn,
  branch: student.branch,
  section: student.section,
}));

const studentValues = normalizedStudents.map((student) => `(${[student.email, student.name, student.crn, student.branch, student.section].map(sqlString).join(', ')})`).join(',\n');
const teacherValues = teachers.map((teacher) => `(${[teacher.name, teacher.email, teacher.department, teacher.subject].map(sqlString).join(', ')})`).join(',\n');

const sql = `-- Generated from first_year_students.json. Safe to re-run.\ninsert into public.lms_students (email, name, crn, branch, section) values\n${studentValues}\non conflict (email) do update set name = excluded.name, crn = excluded.crn, branch = excluded.branch, section = excluded.section;\n\ninsert into public.lms_teachers (name, email, department, subject) values\n${teacherValues}\non conflict (email) do update set name = excluded.name, department = excluded.department, subject = excluded.subject;\n`;
fs.writeFileSync('/home/ubuntu/nextlecture-webapp/supabase/seed_lms.sql', sql);
console.log(JSON.stringify({ students: normalizedStudents.length, teachers: teachers.length, output: 'supabase/seed_lms.sql' }));
