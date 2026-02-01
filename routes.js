import { request } from "./handler/request.js";

const router = (app) => {
  app.post("/request", request);
};

export default router;
