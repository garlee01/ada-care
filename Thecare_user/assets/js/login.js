import { mountShell } from "./ui.js";
import { login, signup } from "./auth.js";

await mountShell();

const msg = document.querySelector("#msg");

document.querySelector("#loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent = "";
  const id = document.querySelector("#id").value.trim();
  const password = document.querySelector("#pw").value;
  try{
    await login({id, password});
    alert("로그인 완료");
    location.href = "/index.html";
  }catch(err){
    msg.textContent = err.message || "로그인 실패";
  }
});

document.querySelector("#signupForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent = "";
  const id = document.querySelector("#sid").value.trim();
  const nickname = document.querySelector("#snick").value.trim();
  const password = document.querySelector("#spw").value;
  try{
    await signup({id, nickname, password});
    alert("회원가입 완료!");
    document.querySelector("#id").value = id;
    document.querySelector("#pw").value = "";
  }catch(err){
    msg.textContent = err.message || "회원가입 실패";
  }
});
