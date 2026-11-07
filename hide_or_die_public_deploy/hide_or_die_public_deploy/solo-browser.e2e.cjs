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
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?e2e=1',{waitUntil:'domcontentloaded'});
    await page.locator('#soloButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__?.snapshot().screen==='game',null,{timeout:20000});
    const initial=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(initial.mode,'solo','Solo mode should start');
    assert.equal(initial.objectives.length,3,'A solo run should have three objectives');
    assert.equal(initial.health,100,'A new incident should start at full health');
    await page.evaluate(()=>{window.__HOD_E2E__.setPosition(-9.15,11.35);window.__HOD_E2E__.interact();});
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).powerOn,true,'Generator breaker should restore facility power');
    const keycard=initial.pickups.find(p=>p.id==='keycard');
    assert.ok(keycard,'A security keycard should be recoverable');
    await page.evaluate(({x,z})=>window.__HOD_E2E__.setPosition(x,z),keycard);
    await page.evaluate(()=>window.__HOD_E2E__.interact());
    assert.ok((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).inventory.includes('keycard'),'Keycard should enter inventory');
    await page.evaluate(()=>{window.__HOD_E2E__.setPosition(-3.55,-11.8);window.__HOD_E2E__.interact();});
    let securityState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(securityState.securityUnlocked,true,'Keycard reader should unlock security wing');
    assert.equal(securityState.doorClear,true,'Unlocked security doorway should become traversable');
    const report=initial.pickups.find(p=>p.id==='report');
    const medkit=initial.pickups.find(p=>p.id==='medkit');
    assert.ok(report&&medkit,'Evidence and medical supplies should spawn in the facility');
    await page.evaluate(({x,z})=>window.__HOD_E2E__.setPosition(x,z),report);
    await page.evaluate(()=>window.__HOD_E2E__.interact());
    let inventoryState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.ok(inventoryState.inventory.includes('report'),'Recovering a report should add it to inventory');
    assert.ok(inventoryState.evidence.includes('report'),'Documents should be added to the incident journal');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#inventoryPanel').evaluate(el=>el.style.display),'grid','Tab should open inventory');
    await page.keyboard.press('Tab');
    await page.keyboard.press('j');
    assert.equal(await page.locator('#journalPanel').evaluate(el=>el.style.display),'grid','J should open the incident journal');
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).paused,true,'Escape should pause Solo simulation');
    await page.locator('#resumeButton').click();
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).paused,false,'Resume should restart Solo simulation');
    await page.evaluate(()=>window.__HOD_E2E__.damage(40));
    await page.evaluate(({x,z})=>window.__HOD_E2E__.setPosition(x,z),medkit);
    await page.evaluate(()=>window.__HOD_E2E__.interact());
    inventoryState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(inventoryState.health,60,'Damage should reduce operator health');
    assert.ok(inventoryState.inventory.includes('medkit'),'Recovered medkit should enter inventory');
    await page.keyboard.press('Tab');
    await page.locator('#inventoryList [data-use="medkit"]').click();
    await page.keyboard.press('Tab');
    inventoryState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(inventoryState.health,100,'Using a recovered medkit should restore health');
    assert.ok(!inventoryState.inventory.includes('medkit'),'A used medkit should be consumed');

    // Exercise all four real keyboard directions relative to the camera heading.
    await page.locator('#gameCanvas').click({force:true});
    const movementStart=await page.evaluate(()=>{
      const api=window.__HOD_E2E__;
      for(let radius=0;radius<=8;radius+=.5){
        for(let dx=-radius;dx<=radius;dx+=.5) for(let dz=-radius;dz<=radius;dz+=.5){
          const x=-6+dx,z=2.5+dz;
          if(api.clearAt(x,z)&&api.clearAt(x+1,z)&&api.clearAt(x-1,z)&&api.clearAt(x,z+1)&&api.clearAt(x,z-1))return{x,z};
        }
      }
      return null;
    });
    assert.ok(movementStart,'Could not find open floor for four-direction movement checks');
    const heading=await page.evaluate(()=>window.__HOD_E2E__.snapshot().yaw);
    const directions=[
      {key:'w',forward:1,side:0,label:'W forward'},
      {key:'s',forward:-1,side:0,label:'S backward'},
      {key:'a',forward:0,side:-1,label:'A left'},
      {key:'d',forward:0,side:1,label:'D right'}
    ];
    for(const direction of directions){
      await page.evaluate(({x,z})=>window.__HOD_E2E__.setPosition(x,z),movementStart);
      const before=await page.evaluate(()=>window.__HOD_E2E__.snapshot().position);
      await page.keyboard.down(direction.key);
      await page.waitForTimeout(500);
      const after=await page.evaluate(()=>window.__HOD_E2E__.snapshot().position);
      await page.keyboard.up(direction.key);
      const dx=after.x-before.x,dz=after.z-before.z;
      const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading);
      const expectedX=fx*direction.forward+rx*direction.side;
      const expectedZ=fz*direction.forward+rz*direction.side;
      const distance=Math.hypot(dx,dz);
      const alignment=distance>0?(dx*expectedX+dz*expectedZ)/distance:-1;
      assert.ok(distance>.12&&alignment>.8,`${direction.label} should move in its intended direction; delta=(${dx.toFixed(3)},${dz.toFixed(3)}), heading=${heading.toFixed(3)}, alignment=${alignment.toFixed(2)}`);
    }
    // Room centres intentionally contain desks, beds, machinery and other props.
    // Find at least one collision-free player position in each room instead of
    // incorrectly requiring its prop-filled geometric centre to be empty.
    const map=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    const blocked=[];
    for(const room of map.rooms){
      let open=false;
      for(let x=room.x-4;x<=room.x+4&&!open;x+=.5){
        for(let z=room.z-4;z<=room.z+4;z+=.5){
          if(await page.evaluate(([a,b])=>window.__HOD_E2E__.clearAt(a,b),[x,z])){open=true;break;}
        }
      }
      if(!open)blocked.push(room.name);
    }
    for(const x of [-18,-6,6,18]) for(const z of [-6,6]) if(!await page.evaluate(([a,b])=>window.__HOD_E2E__.clearAt(a,b),[x,z])) blocked.push('corridor '+x+','+z);
    for(const z of [-12,0,12]) for(const x of [-12,0,12]) if(!await page.evaluate(([a,b])=>window.__HOD_E2E__.clearAt(a,b),[x,z])) blocked.push('corridor '+x+','+z);
    assert.deepEqual(blocked,[],'Every room should have a collision-free player position and every corridor centre should be traversable');

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
    await page.waitForFunction(()=>document.querySelector('#endScreen').style.display==='grid',null,{timeout:5000});
    assert.match(await page.locator('#endTitle').innerText(),/EXTRACTION SUCCESSFUL/);
    await page.locator('#replayButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__.snapshot().screen==='game',null,{timeout:10000});
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
