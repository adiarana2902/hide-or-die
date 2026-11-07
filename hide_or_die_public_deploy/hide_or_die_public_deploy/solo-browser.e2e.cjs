const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

(async()=>{
  const server=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:'4173'},stdio:'ignore'});
  let browser;
  try{
    let ready=false;
    for(let i=0;i<60;i++){
      try{const r=await fetch('http://127.0.0.1:4173/healthz');if(r.ok){ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,500));
    }
    assert.ok(ready,'Express server did not become healthy');
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?e2e=1',{waitUntil:'domcontentloaded'});
    await page.locator('#soloButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__?.snapshot().screen==='game',{timeout:20000});
    const initial=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(initial.mode,'solo','Solo mode should start');
    assert.equal(initial.objectives.length,3,'A solo run should have three objectives');

    // Actual keyboard movement, not a simulated state write.
    await page.locator('#gameCanvas').click({force:true});
    const before=await page.evaluate(()=>window.__HOD_E2E__.snapshot().position);
    await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');
    const after=await page.evaluate(()=>window.__HOD_E2E__.snapshot().position);
    assert.ok(after.z<before.z-0.2,'W should move forward at the default camera heading');

    // Browser collision query at every room centre and every inter-room corridor centre.
    const map=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    const blocked=[];
    for(const room of map.rooms) if(!await page.evaluate(([x,z])=>window.__HOD_E2E__.clearAt(x,z),[room.x,room.z])) blocked.push(room.name);
    for(const x of [-18,-6,6,18]) for(const z of [-6,6]) if(!await page.evaluate(([a,b])=>window.__HOD_E2E__.clearAt(a,b),[x,z])) blocked.push('corridor '+x+','+z);
    for(const z of [-12,0,12]) for(const x of [-12,0,12]) if(!await page.evaluate(([a,b])=>window.__HOD_E2E__.clearAt(a,b),[x,z])) blocked.push('corridor '+x+','+z);
    assert.deepEqual(blocked,[],'Every room centre and corridor centre should be traversable');

    // Collect all three objectives using the same interaction function as the E key.
    for(const item of map.objectives){
      await page.evaluate(([x,z])=>window.__HOD_E2E__.setPosition(x,z),[item.x,item.z]);
      await page.evaluate(()=>window.__HOD_E2E__.interact());
    }
    const collected=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(collected.found,3,'All three power cells should be collectible');

    // Hide and unhide at an actual configured locker approach.
    const locker=map.hideSpots.find(p=>Math.hypot(p.x-collected.position.x,p.z-collected.position.z)>0);
    await page.evaluate(([x,z])=>window.__HOD_E2E__.setPosition(x,z),[locker.x,locker.z]);
    await page.evaluate(()=>window.__HOD_E2E__.toggleHide());
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).hidden,true,'Player should enter hiding state');
    await page.evaluate(()=>window.__HOD_E2E__.toggleHide());
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).hidden,false,'Player should leave hiding state');

    // Verify extraction interaction, death screen, and replay reset.
    await page.evaluate(()=>{const s=window.__HOD_E2E__.snapshot();window.__HOD_E2E__.setPosition(18,12);window.__HOD_E2E__.interact();});
    await page.waitForFunction(()=>document.querySelector('#endScreen').style.display==='grid',{timeout:5000});
    assert.match(await page.locator('#endTitle').innerText(),/EXTRACTION SUCCESSFUL/);
    await page.locator('#replayButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__.snapshot().screen==='game');
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).found,0,'Replay should reset objective count');

    await page.evaluate(()=>window.__HOD_E2E__.forceDeath());
    await page.waitForFunction(()=>document.querySelector('#endScreen').style.display==='grid',{timeout:5000});
    assert.match(await page.locator('#endTitle').innerText(),/CONTAINMENT FAILED/);
    await page.locator('#replayButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__.snapshot().screen==='game');
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).dead,false,'Replay after death should reset player state');
    assert.deepEqual(errors,[],'Browser console should have no uncaught page errors');
    process.stdout.write('SOLO BROWSER QA PASSED: start, WASD, all rooms/corridors, objectives, hiding, extraction, death, replay.\\n');
  }finally{if(browser)await browser.close();server.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
