'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GRID_X,GRID_Z,isWalkable}=require('./game-logic');
test('all 12 facility rooms are walkable',()=>{assert.equal(GRID_X.length*GRID_Z.length,12);for(const x of GRID_X)for(const z of GRID_Z)assert.equal(isWalkable(x,z),true);});
test('horizontal and vertical corridors connect rooms',()=>{for(const z of GRID_Z)for(let i=0;i<GRID_X.length-1;i++)assert.equal(isWalkable((GRID_X[i]+GRID_X[i+1])/2,z),true);for(const x of GRID_X)for(let i=0;i<GRID_Z.length-1;i++)assert.equal(isWalkable(x,(GRID_Z[i]+GRID_Z[i+1])/2),true);});
test('invalid areas are rejected',()=>{assert.equal(isWalkable(-12,-8.5),false);assert.equal(isWalkable(30,0),false);assert.equal(isWalkable(0,30),false);assert.equal(isWalkable(NaN,0),false);});
