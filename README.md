># medoo.js     
_medoo_ is js version of [medoo.php](http://medoo.in/).   
_medoo_ write based on ES7 async/wait.   
But now it just support mysql.

># Usage   
```javascript
const Medoo = require('medoo');   
const Setting = {   
    host: 'localhost',   
    port: 3306,   
    database: 'terraria',   
    user: 'terraria',   
    password: '04140906',   
    debug_mode: true   
}
let medoo = new Medoo(Setting);
await medoo.setup(); // this code must call in a async function
```   
## method list   
```javascript
    setup(option = null)
    release()
    select(table, join, columns = null, where = null)
    insert(table, datas)
    delete(table, where)
    update(table, data, where = null)
    get(table, join = null, columns = null, where = null)
    has(table, join, where = null)
    count(table, join, column, where = null)
    max(table, join, column = null, where = null)
    min(table, join, column = null, where = null)
    avg(table, join, column = null, where = null)
    sum(table, join, column = null, where = null)
    alter(table, action, column)
    action(actions)
```
Usage of _medoo_ is simply like medoo.php, please read [medoo.php doc](http://medoo.in/doc) here is just a little dif.    
>As in php, object is use [] to init, but in javascript it use {}.     
>So just change [] to {} if nessesary.

># Todo list    
* add other db support   
* write documents   
