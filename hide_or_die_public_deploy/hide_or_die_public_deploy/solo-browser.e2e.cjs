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
    assert.ok(!securityState.evidence.includes('schematic'),'Unlocking the security door must not silently grant an uncollected document');
    const schematic=initial.pickups.find(p=>p.id==='schematic');
    assert.ok(schematic,'Facility schematic should spawn as a recoverable document');
    await page.evaluate(({x,z})=>window.__HOD_E2E__.setPosition(x,z),schematic);
    await page.evaluate(()=>window.__HOD_E2E__.interact());
    securityState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.ok(securityState.evidence.includes('schematic'),'The schematic should enter the journal only after pickup');
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

    // Exercise real keyboard input in four unobstructed lanes with a deterministic camera heading.
    await page.locator('#gameCanvas').click({force:true});
    await page.evaluate(()=>document.exitPointerLock?.());
    await page.waitForFunction(()=>document.pointerLockElement===null);
    const directions=[
      {key:'w',forward:1,side:0,label:'W forward',dx:0,dz:-1},
      {key:'s',forward:-1,side:0,label:'S backward',dx:0,dz:1},
      {key:'a',forward:0,side:-1,label:'A left',dx:-1,dz:0},
      {key:'d',forward:0,side:1,label:'D right',dx:1,dz:0}
    ];
    for(const direction of directions){
      const lane=await page.evaluate(({dx,dz})=>{
        const api=window.__HOD_E2E__,step=.1,distance=1.5;
        // Search the facility for a continuous, collision-free lane in this direction.
        for(let z=-15;z<=15;z+=.5)for(let x=-21;x<=21;x+=.5){
          if(!api.clearAt(x,z))continue;
          let clear=true;
          for(let d=step;d<=distance+1e-6;d+=step){
            if(!api.clearAt(x+dx*d,z+dz*d)){clear=false;break;}
          }
          if(clear)return{x,z};
        }
        return null;
      },direction);
      assert.ok(lane, `Could not find a continuous clear lane for ${direction.label}`);
      await page.evaluate(({x,z})=>{window.__HOD_E2E__.setPosition(x,z);window.__HOD_E2E__.setYaw(0);},lane);
      const beforeState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
      const before=beforeState.position;
      const heading=beforeState.yaw;
      await page.keyboard.down(direction.key);
      await page.waitForTimeout(600);
      const after=await page.evaluate(()=>window.__HOD_E2E__.snapshot().position);
      await page.keyboard.up(direction.key);
      const afterState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
      const dx=after.x-before.x,dz=after.z-before.z;
      const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading);
      const expectedX=fx*direction.forward+rx*direction.side;
      const expectedZ=fz*direction.forward+rz*direction.side;
      const distance=Math.hypot(dx,dz);
      const alignment=distance>0?(dx*expectedX+dz*expectedZ)/distance:-1;
      assert.ok(Math.abs(afterState.yaw-heading)<.01,`${direction.label} camera heading should remain stable during keyboard-only movement`);
      assert.ok(distance>.08&&alignment>.9,`${direction.label} should move in its intended direction; delta=(${dx.toFixed(3)},${dz.toFixed(3)}), heading=${heading.toFixed(3)}, alignment=${alignment.toFixed(2)}`);
    }
    // Room centres intentionally contain desks, beds, machinery and other props.
    // Find at least one collision-free player position in each room instead of
    // incorrectly requiring its prop-filled geometric centre to be empty.
    const map=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    const blocked=await page.evaluate(()=>{
      const api=window.__HOD_E2E__,snapshot=api.snapshot(),bad=[];
      for(const room of snapshot.rooms){
        let open=false;
        for(let x=room.x-4;x<=room.x+4&&!open;x+=.5)for(let z=room.z-4;z<=room.z+4;z+=.5)if(api.clearAt(x,z)){open=true;break;}
        if(!open)bad.push(room.name);
      }
      for(const x of [-18,-6,6,18])for(const z of [-6,6])if(!api.clearAt(x,z))bad.push('corridor '+x+','+z);
      for(const z of [-12,0,12])for(const x of [-12,0,12])if(!api.clearAt(x,z))bad.push('corridor '+x+','+z);
      return bad;
    });
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
    const career=await page.evaluate(()=>JSON.parse(localStorage.getItem('hod-career-v1')||'{}'));
    assert.ok(career.wins>=1&&career.xp>=150&&career.completed.includes(initial.scenario),'Successful extraction should persist story progress and XP reward');
    await page.locator('#replayButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__.snapshot().screen==='game',null,{timeout:10000});
    const replayState=await page.evaluate(()=>window.__HOD_E2E__.snapshot());
    assert.equal(replayState.found,0,'Replay should reset objective count');
    assert.notEqual(replayState.scenario,initial.scenario,'Replay should offer a different uncompleted incident');

    await page.evaluate(()=>window.__HOD_E2E__.forceDeath());
    await page.waitForFunction(()=>document.querySelector('#endScreen').style.display==='grid',{timeout:5000});
    assert.match(await page.locator('#endTitle').innerText(),/CONTAINMENT FAILED/);
    await page.locator('#replayButton').click();
    await page.waitForFunction(()=>window.__HOD_E2E__.snapshot().screen==='game');
    assert.equal((await page.evaluate(()=>window.__HOD_E2E__.snapshot())).dead,false,'Replay after death should reset player state');
    assert.deepEqual(errors,[],'Browser console should have no uncaught page errors');
    // Mobile viewport QA: touch HUD, joystick movement and compact layout.
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    mobile.setDefaultTimeout(15000);
    const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
    await mobile.goto('http://127.0.0.1:4173/?e2e=1',{waitUntil:'domcontentloaded'});
    await mobile.locator('#soloButton').click();
    await mobile.waitForFunction(()=>window.__HOD_E2E__?.snapshot().screen==='game',null,{timeout:20000});
    assert.equal(await mobile.locator('#mobileControls').evaluate(el=>getComputedStyle(el).display),'block','Mobile touch controls should be visible at phone width');
    assert.equal(await mobile.locator('#mobileStick').isVisible(),true,'Movement joystick should be visible');
    const mobileStart=await mobile.evaluate(()=>{
      const api=window.__HOD_E2E__;
      for(let z=-14;z<14;z+=.5)for(let x=-20;x<20;x+=.5)if(api.clearAt(x,z)&&api.clearAt(x,z-1.2))return{x,z};
      return null;
    });
    assert.ok(mobileStart,'Mobile QA should find a clear movement lane');
    await mobile.evaluate(({x,z})=>{window.__HOD_E2E__.setPosition(x,z);window.__HOD_E2E__.setYaw(0);},mobileStart);
    const stickBox=await mobile.locator('#mobileStick').boundingBox();
    await mobile.mouse.move(stickBox.x+stickBox.width/2,stickBox.y+stickBox.height/2);
    await mobile.mouse.down();
    await mobile.mouse.move(stickBox.x+stickBox.width/2,stickBox.y+stickBox.height/2-42,{steps:5});
    await mobile.waitForTimeout(500);
    const mobileMoved=await mobile.evaluate(()=>window.__HOD_E2E__.snapshot().position);
    await mobile.mouse.up();
    assert.ok(mobileMoved.z<mobileStart.z-.25,'Mobile joystick drag should move the player forward');
    await mobile.locator('#touchInventory').tap();
    assert.equal(await mobile.locator('#inventoryPanel').evaluate(el=>el.style.display),'grid','Mobile inventory action should open inventory');
    await mobile.locator('#touchInventory').tap();
    await mobile.locator('#touchJournal').tap();
    assert.equal(await mobile.locator('#journalPanel').evaluate(el=>el.style.display),'grid','Mobile journal action should open journal');
    assert.deepEqual(mobileErrors,[],'Mobile browser should have no uncaught page errors');
    await mobile.close();
    process.stdout.write('SOLO + MOBILE BROWSER QA PASSED: start, WASD, all rooms/corridors, objectives, hiding, extraction, death, replay, mobile joystick and touch HUD.\\n');
  }finally{if(browser)await browser.close();server.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
