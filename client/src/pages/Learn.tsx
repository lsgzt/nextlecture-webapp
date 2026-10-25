import { useLocation, useRoute } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Login } from "./learn/login";
import { Dashboard } from "./learn/dashboard";
import { Teachers, TeacherDetail } from "./learn/teachers";
import { Courses } from "./learn/courses";
import { Watch } from "./learn/watch";
import { Admin } from "./learn/admin";

export default function Learn() {
  const [path] = useLocation();
  const [, paramsWatch] = useRoute("/learn/watch/:id");
  const [, paramsTeacher] = useRoute("/learn/teachers/:id");
  const reduce = useReducedMotion();

  let page: React.ReactNode;
  if (path === "/learn/login") page = <Login />;
  else if (path === "/learn/admin") page = <Admin />;
  else if (paramsWatch?.id) page = <Watch id={paramsWatch.id} />;
  else if (paramsTeacher?.id) page = <TeacherDetail id={paramsTeacher.id} />;
  else if (path === "/learn/teachers") page = <Teachers />;
  else if (path.startsWith("/learn/courses")) page = <Courses />;
  else page = <Dashboard />;

  return (
    <motion.div
      key={path}
      initial={reduce ? undefined : { opacity: 0 }}
      animate={reduce ? undefined : { opacity: 1 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {page}
    </motion.div>
  );
}
