import { mountShell, requireLogin } from "./ui.js";
import { createPost, signUpload } from "./store.js";

await mountShell();

const sp = new URLSearchParams(location.search);
const board = sp.get("board") || "jobs";
document.querySelector("#board").value = board;

document.querySelector("#writeForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!requireLogin()) return;

  const title = document.querySelector("#title").value.trim();
  const content = document.querySelector("#body").value.trim();

  if(!title || !content){
    alert("제목/내용을 입력해주세요.");
    return;
  }

  // tags는 UI용(현재는 저장하지 않음). 필요하면 content에 포함하거나 서버 스키마 확장
  // const tags = document.querySelector("#tags").value.split(",").map(s=>s.trim()).filter(Boolean);

  const files = document.querySelector("#files").files;
  const media = [];

  if(files && files.length){
    for(const f of files){
      // API 모드: R2 signed upload
      try{
        const signed = await signUpload(f.name, f.type || "application/octet-stream");
        const put = await fetch(signed.url, { method:"PUT", headers: { "content-type": signed.contentType }, body: f });
        if(!put.ok) throw new Error("업로드 실패");
        media.push({ key: signed.key, type: f.type, name: f.name, size: f.size });
      }catch(err){
        alert(`파일 업로드 실패: ${f.name}
${err.message||err}`);
        return;
      }
    }
  }

  const id = await createPost({ board: document.querySelector("#board").value, title, content, media });
  location.href = `/pages/post.html?id=${encodeURIComponent(id)}`;
});
