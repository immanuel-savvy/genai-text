import { DB } from "./conn.js";

const LLM_TASKS = async () => {
  let fold = await DB().collection("LLM_Tasks");

  return fold;
};

export { LLM_TASKS };
