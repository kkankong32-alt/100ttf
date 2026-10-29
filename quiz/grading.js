(function(root){
  const normalize=s=>String(s??'').normalize('NFKC').replace(/\s|[.,!?。·]/g,'').toLowerCase();
  function essayGrade(value){
    const s=normalize(value);
    if(s.length<8)return null;
    // 의미를 확정하기 어려운 부정·상반 표현은 오답으로 단정하지 않고 교사 검토로 보냄.
    if(/않|아니|안잠|안줄|안감소|안좁|넓어|넓어진|늘어|증가|낮아|내려|모르/.test(s))return null;
    const flooding=/(해안|육지|땅|마을|집|터전|살곳).{0,24}(잠기|잠겨|잠긴|침수)/.test(s);
    const lessLand=/(육지|땅|면적|터전|살곳|살수있는곳|살수있는공간|생활공간).{0,30}(줄어|줄었|줄게|감소|좁아|작아|적어)/.test(s);
    return flooding&&lessLand ? true : null;
  }
  function grade(q,value){
    if(q.type==='essay')return essayGrade(value);
    if(q.type==='order')return Array.isArray(value)&&value.length===q.answer.length&&value.every((n,i)=>n===q.answer[i]);
    if(q.type==='short'||q.type==='initial')return q.accepted.some(a=>normalize(a)===normalize(value));
    return typeof value==='number'&&value===q.answer;
  }
  function summary(questions,answers,review){
    const grades=questions.map((q,i)=>answers[i]==null?undefined:q.type==='essay'&&typeof review==='boolean'?review:grade(q,answers[i]));
    return {grades,correct:grades.filter(x=>x===true).length,pending:grades.filter(x=>x===null).length,done:answers.every(x=>x!=null)};
  }
  root.QuizGrade={normalize,grade,summary};
  if(typeof module!=='undefined')module.exports=root.QuizGrade;
})(typeof globalThis!=='undefined'?globalThis:this);