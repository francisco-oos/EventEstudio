"use strict";

/* Adaptador exclusivo de pruebas para entornos de auditoría que ya incluyen
   node:sqlite pero no pueden instalar el binario nativo better-sqlite3. No se
   carga en producción ni cambia el contrato de dependencias de EventStudio. */
const fs=require("node:fs");
const {DatabaseSync,backup}=require("node:sqlite");

class BetterSqlite3TestAdapter{
  constructor(filename,options={}){
    if(options.fileMustExist&&!fs.existsSync(filename))throw new Error(`Base inexistente: ${filename}`);
    this._database=new DatabaseSync(filename,{readOnly:Boolean(options.readonly)});
  }
  prepare(sql){
    const statement=this._database.prepare(sql);
    const plain=row=>row==null?row:{...row};
    return {
      run:(...parameters)=>statement.run(...parameters),
      get:(...parameters)=>plain(statement.get(...parameters)),
      all:(...parameters)=>statement.all(...parameters).map(plain),
      iterate:(...parameters)=>statement.iterate(...parameters)
    };
  }
  exec(sql){this._database.exec(sql);return this;}
  close(){return this._database.close();}
  pragma(expression,options={}){
    const sql=`PRAGMA ${String(expression||"").trim()}`;
    if(/=/.test(expression)){this._database.exec(sql);return options.simple?undefined:[];}
    const rows=this._database.prepare(sql).all();
    if(!options.simple)return rows;
    const row=rows[0];
    return row?row[Object.keys(row)[0]]:undefined;
  }
  transaction(callback){
    return (...args)=>{
      this._database.exec("BEGIN");
      try{
        const result=callback(...args);
        this._database.exec("COMMIT");
        return result;
      }catch(error){
        try{this._database.exec("ROLLBACK");}catch{}
        throw error;
      }
    };
  }
  backup(destination){return backup(this._database,destination);}
}

module.exports=BetterSqlite3TestAdapter;
