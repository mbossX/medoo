
var mysql = require('mysql2/promise');

var is_array = function(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}
var is_object = function(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}
var is_string = function(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
}

var is_numeric = function(obj) {
    return Object.prototype.toString.call(obj) === '[object Number]';
}

let object_keys = (obj) => {
    let arr = [];
    for (let i in obj) {
        if (obj.hasOwnProperty(i)) {
            arr.push(i);
        }
    }
    return arr;
}

class Medoo {

    constructor(option) {
        option = option || {};
        if (!option.host) {
            option.host = 'localhost';
        }
        if (!option.port) {
            option.port = 3306;
        }
        if (!option.database) {
            option.database = '';
        }
        if (!option.user) {
            option.user = 'root';
        }
        if (!option.password) {
            option.password = '';
        }
        this.option = option;
        this.prefix = option.prefix || '';
        this.debug_mode = option.debug_mode || false;
        //this.setup(option);
    }

    async setup(option = null) {
        option = option || this.option;
        this.connection = await mysql.createConnection(option);
    }

    async release() {
        await this.connection.end();
    }

    escape(str) {
        return this.connection.connection.escape(str);
    }

    table_escape(table) {
        return '`' + this.prefix + table + '`';
    }

    column_escape(column) {
        let column_match = /(\(JSON\)\s*|^#)?([a-zA-Z0-9_]*)\.([a-zA-Z0-9_]*)/.exec(column);

        if (column_match && is_array(column_match) && column_match.length > 3 && column_match[3]) {
            return this.table_escape(column_match[2]) + '.`' + column_match[3] + '`';
        }

        return '`' + column + '`';
    }

    array_escape(array) {
        let temp = [];

        for (let i in array) {
            let value = array[i];
            temp.push(is_numeric(value) ? value : this.escape(value));
        }

        return temp.join(',');
    }

    fn_escape(column, str) {
        return (column.indexOf('#') === 0 && /^[A-Z0-9\_]*\([^)]*\)/.test(str)) ?
            str :
            this.escape(str);
    }

    async query(sql) {
        if (this.debug_mode) {
            console.log(sql);
        }
        try {
            return await this.connection.query(sql);
        } catch (err) {
            console.log(err.Error);
            return [false, 0];
        }
    }

    async execute(sql) {
        if (this.debug_mode) {
            console.log(sql);
        }
        try {
            return await this.connection.execute(sql);
        } catch (err) {
            console.log(err);
            return [false, 0];
        }
    }

    select_context(table, join, columns = null, where = null, column_fn) {
        let table_match = /([a-zA-Z0-9_\-]*)\s*\(([a-zA-Z0-9_\-]*)\)/i.exec(table);

        let table_query, table_as;
        if (is_array(table_match) && table_match.length > 2 && table_match[2]) {
            table = this.table_escape(table_match[1]);
            table_query = this.table_escape(table_match[1]) + ' AS ' + this.table_escape(table_match[2]);
            table_as = this.table_escape(table_match[2]);
        }
        else {
            table = this.table_escape(table);
            table_query = table;
        }

        let join_key = is_object(join) ? object_keys(join) : null;

        let table_join, join_array;
        if (join_key && join_key[0] && join_key[0][0] === '[') {
            table_join = [];

            join_array = {
                '>': 'LEFT',
                '<': 'RIGHT',
                '<>': 'FULL',
                '><': 'INNER'
            };
            for (let key in join) {
                if (!join.hasOwnProperty(key)) {
                    continue;
                }
                let sub_table = key;
                let relation = join[key];
                let match = /(\[(\<|\>|\>\<|\<\>)\])?([a-zA-Z0-9_\-]*)\s?(\(([a-zA-Z0-9_\-]*)\))?/.exec(sub_table);

                if (match && is_array(match) && match[2] != '' && match[3] != '') {
                    if (is_string(relation)) {
                        relation = 'USING ("' + relation + '")';
                    }
                    if (is_array(relation) && relation.length > 0) {
                        // For ['column1', 'column2']
                        relation = 'USING ("' + relation.join('", "') + '")';
                    }
                    if (is_object(relation)) {
                        let joins = [];

                        for (let key in relation) {
                            if (!relation.hasOwnProperty) {
                                continue;
                            }
                            let value = relation[key];
                            joins.push(
                                key.indexOf('.') > 0 ? this.column_escape(key) : (table_as ? table_as : table) + '.`' + key + '`' +
                                    '=' +
                                    this.table_escape(match.length > 5 && match[5] ? match[5] : match[3]) + '.`' + value + '`');
                        }

                        relation = 'ON ' + joins.join(' AND ');
                    }

                    let table_name = this.table_escape(match[3]) + ' ';

                    if (match.length > 5 && match[5]) {
                        table_name += 'AS ' + this.table_escape(match[5]) + ' ';
                    }

                    table_join.push(join_array[match[2]] + ' JOIN ' + table_name + relation);
                }
            }
            table_query += ' ' + table_join.join(' ');
        } else {
            if (!columns) {
                if (!where) {
                    if (
                        is_array(join) &&
                        column_fn
                    ) {
                        where = join;
                        columns = null;
                    }
                    else {
                        where = null;
                        columns = join;
                    }
                }
                else {
                    where = join;
                    columns = null;
                }
            }
            else {
                where = columns;
                columns = join;
            }
        }

        let column;
        if (column_fn) {
            if (column_fn == 1) {
                column = '1';
                if (!where) {
                    where = columns;
                }
            }
            else {
                if (!columns || columns.length == 0) {
                    columns = '*';
                    where = join;
                }
                column = column_fn + '(' + this.column_push(columns) + ') as tmp';
            }
        } else {
            column = this.column_push(columns);
        }

        if (columns && columns.indexOf('*') > 0) {
            if (table_as && columns == (table_as.substr(1, table_as.length - 2) + ".*")) {
                column = table_as + ".*";
            } else if (columns == (table && table.substr(1, table.length - 2) + ".*")) {
                column = table + ".*";
            }
        }
        return 'SELECT ' + column + ' FROM ' + table_query + this.where_clause(where);
    }

    column_push(columns) {
        if (columns == '*') {
            return columns;
        }

        if (is_string(columns)) {
            columns = columns.split(',');
        }
        if (is_object(columns)) {
            let column = [];
            for (let key_ in columns) {
                if (!columns.hasOwnProperty(key_)) {
                    continue;
                }
                column.push(this.column_push(columns[key_]));
            }
            return column.join(',');
        }
        else if (is_array(columns)) {
            let stack = [];
            for (let key in columns) {
                let value = columns[key];
                if (is_object(value)) {
                    stack.push(this.column_push(value));
                }
                else if (is_array(value)) {
                    stack.push(this.column_push(value));
                }
                else {
                    let match = /([a-zA-Z0-9_\-\.]*)\s*\(([a-zA-Z0-9_\-]*)\)/i.exec(value);

                    if (match && is_array(match) && match.length > 2 && match[2]) {
                        stack.push(this.column_escape(match[1]) + ' AS ' + this.column_escape(match[2]));
                        columns[key] = match[2];
                    }
                    else {
                        stack.push(this.column_escape(value));
                    }
                }
            }

            return stack.join(',');
        }
    }

    where_clause(where) {
        let where_clause = '';
        
        if (is_object(where)) {
            let where_keys = object_keys(where);
            let where_AND = []; //preg_grep("/^AND\s*#?/i", where_keys);
            let where_OR = []; //preg_grep("/^OR\s*#?/i", where_keys);
            where_keys.forEach(item => {
                if (/^OR \s*#?/i.test(item)) {
                    where_OR.push(item);
                }if (/^AND \s*#?/i.test(item)) {
                    where_AND.push(item);
                }
            });

            let all_where = ['AND', 'OR', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'LIKE', 'MATCH'];
            let single_condition = {};
            let conditions = 0;
            for (let key_ in where) {
                if (!where.hasOwnProperty(key_)) {
                    continue;
                }
                let key__ = key_;
                if (key_.indexOf('#') > -1) {
                    key__ = key_.substr(0, key_.indexOf('#'));
                    key__ = key__.trim();
                }
                if (all_where.indexOf(key__) < 0) {
                    single_condition[key_] = where[key_];
                    conditions++;
                }
            }

            if (conditions > 0) {
                let condition = this.data_implode(single_condition, conditions > 1 ? ' AND' : '');

                if (condition != '') {
                    where_clause = ' WHERE ' + condition;
                }
            }

            if (where_AND.length > 0) {
                let value = where_AND;
                where_clause = ' WHERE ' + this.data_implode(where[value[0]], ' AND');
            }

            if (where_OR.length > 0) {
                let value = where_OR;
                where_clause = ' WHERE ' + this.data_implode(where[value[0]], ' OR');
            }

            if (where['MATCH']) {
                let MATCH = where['MATCH'];

                if (is_array(MATCH) && MATCH['columns'] && MATCH['keyword']) {
                    where_clause += (where_clause != '' ? ' AND ' : ' WHERE ') + ' MATCH ("' + MATCH['columns'].join('", "').replace('.', '"."') + '") AGAINST (' + MATCH['keyword'] + ')';
                }
            }

            if (where['GROUP']) {
                where_clause += ' GROUP BY ' + this.column_escape(where['GROUP']);

                if (where['HAVING']) {
                    where_clause += ' HAVING ' + this.data_implode(where['HAVING'], ' AND');
                }
            }

            if (where['ORDER']) {
                let ORDER = where['ORDER'];

                if (is_object(ORDER)) {
                    let stack = [];

                    for (let column in ORDER) {
                        if (!ORDER.hasOwnProperty(column)) {
                            continue;
                        }
                        let value = ORDER[column];
                        if (is_array(value)) {
                            stack.push('FIELD(' + this.column_escape(column) + ', ' + this.array_escape(value) + ')');
                        }
                        else if (value === 'ASC' || value === 'DESC') {
                            stack.push(this.column_escape(column) + ' ' + value);
                        } else if (is_numeric(column)) {
                            stack.push(this.column_escape(value));
                        }
                    }
                    
                    where_clause += ' ORDER BY ' + stack.join(',');
                }
                else {
                    where_clause += ' ORDER BY ' + this.column_escape(ORDER);
                }
            }

            if (where['LIMIT']) {
                let LIMIT = where['LIMIT'];

                if (is_numeric(LIMIT)) {
                    where_clause += ' LIMIT ' + LIMIT;
                }

                if (
                    is_array(LIMIT) &&
                    LIMIT.length > 1 &&
                    is_numeric(LIMIT[0]) &&
                    is_numeric(LIMIT[1])
                ) {
                    where_clause += ' LIMIT ' + LIMIT[0] + ',' + LIMIT[1];
                }
            }
        }

        return where_clause;
    }

    data_implode(data, conjunctor, outer_conjunctor = null) {
        let wheres = [];

        for (let key in data) {
            if (!data.hasOwnProperty(key)) {
                continue;
            }
            let value = data[key];
            let type = Object.prototype.toString.call(value);
            let relation_match = /^(AND|OR)(\s+#.*)?/i.exec(key);
            if (
                relation_match && is_array(relation_match) && relation_match.length > 0 &&
                type == '[object Object]'
            ) {
                // wheres.push(0 !== count(array_diff_key(value, array_keys(array_keys(value)))) ?
                //     '('.this .data_implode(value, ' '.relation_match[1]). ')' :
                // '('.this .inner_conjunct(value, ' '.relation_match[1], conjunctor). ')';
                wheres.push('(' + this.data_implode(value, ' ' + relation_match[1]) + ')');
            }
            else {
                let match = /(#?)([\w\.\-]+)(\[(\>|\>\=|\<|\<\=|\!|\<\>|\>\<|\!?~)\])?/i.exec(key);
                let column = this.column_escape(match[2]);

                if (match.length > 4 && match[4]) {
                    let operator = match[4];

                    if (operator == '!') {
                        switch (type) {
                            case '[object Null]':
                                wheres.push(column + ' IS NOT NULL');
                                break;

                            case '[object Array]':
                                wheres.push(column + ' NOT IN (' + this.array_escape(value) + ')');
                                break;

                            case '[object Number]':
                                wheres.push(column + ' != ' + value);
                                break;

                            case '[object Boolean]':
                                wheres.push(column + ' != ' + (value ? '1' : '0'));
                                break;

                            case '[object String]':
                                wheres.push(column + ' != ' + this.fn_escape(key, value));
                                break;
                        }
                    }

                    if (operator == '<>' || operator == '><') {
                        if (type == '[object Array]') {
                            if (operator == '><') {
                                column += ' NOT';
                            }

                            if (value.length > 1 && is_numeric(value[0]) && is_numeric(value[1])) {
                                wheres.push('(' + column + ' BETWEEN ' + value[0] + ' AND ' + value[1] + ')');
                            }
                            else {
                                wheres.push('(' + column + ' BETWEEN ' + this.escape(value[0]) + ' AND ' + this.escape(value[1]) + ')');
                            }
                        }
                    }

                    if (operator == '~' || operator == '!~') {
                        if (type != '[object Array]') {
                            value = [value];
                        }

                        let like_clauses = [];

                        value.forEach(item => {
                            item = item + '';

                            if (/^[^%|\[|\]|_]+/.test(item)) {
                                item = '%' + item + '%';
                            }

                            like_clauses.push(column + (operator === '!~' ? ' NOT' : '') + ' LIKE ' + this.fn_escape(key, item));
                        })

                        wheres.push(like_clauses.join(' OR '));
                    }

                    if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
                        let condition = column + ' ' + operator + ' ';

                        if (is_numeric(value)) {
                            condition += value;
                        }
                        else if (key.indexOf('#') === 0) {
                            condition += this.fn_escape(key, value);
                        } else if (is_string(value)) {
                            condition += this.escape(value);
                        }
                        else {
                            condition += "'" + this.escape(value) + "'";
                        }

                        wheres.push(condition);
                    }
                }
                else {
                    switch (type) {
                        case '[object Null]':
                            wheres.push(column + ' IS NULL');
                            break;

                        case '[object Array]':
                            wheres.push(column + ' IN (' + this.array_escape(value) + ')');
                            break;

                        case '[object Number]':
                            wheres.push(column + ' = ' + value);
                            break;

                        case '[object Boolean]':
                            wheres.push(column + ' = ' + (value ? '1' : '0'));
                            break;

                        case '[object String]':
                            wheres.push(column + ' = ' + this.fn_escape(key, value));
                            break;
                    }
                }
            }
        }

        return wheres.join(conjunctor + ' '); //implode(conjunctor. ' ', wheres);
    }

    data_map(key, value, data, stack) {
        if (is_array(value)) {
            for (let sub_key in value) {
                let sub_value = value[sub_key];
                if (is_object(sub_value)) {
                    for (let key_ in sub_value) {
                        if (!sub_value.hasOwnProperty(key_)) {
                            continue;
                        }
                        stack[key_] = {};
                        this.data_map(key_, sub_value[key_], data, stack[key_]);
                    }
                }
                else {
                    this.data_map(sub_value.replace('/^[\w]*\./i', ""), sub_key, data, stack);
                }
            }
        }
        else {
            key = key.replace(/^[\w]*\./i, "");
            let keyas = key;
            let key_match = /([a-zA-Z0-9_\-\.]*)\s*\(([a-zA-Z0-9_\-]*)\)/i.exec(key);
            if (key_match && is_array(key_match) && key_match.length > 2 && key_match[2]) {
                keyas = key_match[2];
                key = key_match[1];
            }
            stack[keyas] = data[key];
        }
    }

    async select(table, join, columns = null, where = null) {
        if (arguments.length < 2) return false;

        let columns_real;
        let join_key = is_object(join) ? object_keys(join) : null;
        if (join_key && join_key[0] && join_key[0][0] === '[') {
            if (arguments.length < 3) {
                return false;
            } else if (!is_array(columns) && !is_string(columns)) {
                return false;
            }
            columns_real = columns;
        } else {
            if (!is_array(join) && !is_string(join)) {
                return false;
            }
            columns_real = join;
        }

        let column = where == null ? join : columns;
        let is_single_column = (is_string(column) && column.indexOf(',') < 0 && column !== '*');
        let [query, filds] = await this.query(this.select_context(table, join, columns, where));
        // columns = paras.columns;

        if (!query || query.length < 1) {
            return false;
        }
        if (columns_real === '*') {
            return query;
        }
        if (is_single_column) {
            return query;
        }

        let stack = [];
        let index = 0;
        query.forEach(row => {
            stack.push({});
            columns_real.forEach(column => {
                if (is_object(column)) {
                    for (let key_ in column) {
                        if (!column.hasOwnProperty(key_)) {
                            continue;
                        }
                        stack[stack.length - 1][key_] = {};
                        this.data_map(key_, column[key_], row, stack[stack.length - 1][key_]);
                    }
                } else {
                    this.data_map(column, column, row, stack[stack.length - 1]);
                }
            });

            index++;
        });

        return stack;
    }

    async insert(table, datas) {
        let lastId = [];

        // Check indexed or associative array
        if (!is_array(datas)) {
            datas = [datas];
        }

        for (let i in datas) {
            let data = datas[i];
            if (!is_object(data)) {
                return;
            }
            let values = [];
            let columns = [];

            for (let key in data) {
                let value = data[key];
                if (value === undefined) {
                    continue;
                }
                columns.push(this.column_escape(key.replace(/^(\(JSON\)\s*|#)/i, "")));

                switch (Object.prototype.toString.call(value)) {
                    case '[object Null]':
                        values.push('NULL');
                        break;

                    case '[object Array]':
                        values.push(this.escape(JSON.stringify(value)));
                        break;

                    case '[object Boolean]':
                        values.push(value ? '1' : '0');
                        break;

                    case '[object Number]':
                    case '[object String]':
                        values.push(this.fn_escape(key, value));
                        break;
                }
            }

            let result = await this.execute('INSERT INTO ' + this.table_escape(table) + ' (' + columns.join(', ') + ') VALUES (' + values.join(', ') + ')');
            if (is_array(result) && result.length > 0 && result[0]) {
                lastId.push(result[0].insertId);
            } else {
                return false;
            }
        };
        return lastId.length > 0 ? lastId[lastId.length - 1] : false;
    }

    async delete(table, where) {
        let result = await this.execute('DELETE FROM ' + this.table_escape(table) + this.where_clause(where));
        if (is_array(result) && result.length > 0 && result[0] && result[0].affectedRows > 0) {
            return result[0].affectedRows;
        } else {
            return false;
        }
    }

    async update(table, data, where = null) {
        let fields = [];

        for (let key in data) {
            if (!data.hasOwnProperty(key)) {
                continue;
            }
            let value = data[key];
            let match = /([\w]+)(\[(\+|\-|\*|\/)\])?/i.exec(key);

            if (match && match.length > 3 && match[3]) {
                if (is_numeric(value)) {
                    fields.push(this.column_escape(match[1]) + ' = ' + this.column_escape(match[1]) + ' ' + match[3] + ' ' + value);
                } else if (is_string(value)) {
                    fields.push(this.column_escape(match[1]) + ' = ' + this.column_escape(match[1]) + ' ' + match[3] + ' ' + this.escape(value));
                }
            } else {
                let column = this.column_escape(key.replace(/^(\(JSON\)\s*|#)/i, ""));

                switch (Object.prototype.toString.call(value)) {
                    case '[object Null]':
                        fields.push(column + ' = NULL');
                        break;

                    case '[object Array]':
                        fields.push(column + ' = ' + this.escape(JSON.stringify(value)));
                        break;

                    case '[object Boolean]':
                        fields.push(column + ' = ' + (value ? '1' : '0'));
                        break;

                    case '[object Number]':
                    case '[object String]':
                        fields.push(column + ' = ' + this.fn_escape(key, value));
                        break;
                }
            }
        }

        let result = await this.execute('UPDATE ' + this.table_escape(table) + ' SET ' + fields.join(', ') + this.where_clause(where));
        if (is_array(result) && result.length > 0 && result[0] && result[0].affectedRows > 0) {
            return result[0].affectedRows;
        } else {
            return false;
        }
    }

    async get(table, join = null, columns = null, where = null) {
        if (arguments.length < 2) return false;
        let join_key = is_object(join) ? object_keys(join) : null;
        if (join_key && join_key[0] && join_key[0][0] === '[') {
            if (arguments.length < 3 || !is_array(columns)) {
                return false;
            } else if (arguments.length > 3) {
                where["LIMIT"] = 1;
            }
        } else {
            // if (!is_array(join)) {
            //     return false;
            // }
            if (arguments.length > 2) {
                columns["LIMIT"] = 1;
            }
        }
        let rows = await this.select(table, join, columns, where);
        if (rows.length && rows.length > 0) {
            return rows[0];
        } else {
            return false;
        }
    }

    async has(table, join, where = null) {
        let sql;
        if (!where) {
            where = 1;
        }
        let [query, _] = await this.query('SELECT EXISTS(' + this.select_context(table, join, null, where, 1) + ') as count');
        if (query && query.length > 0) {
            return query[0]['count'] === 1;
        }
        else {
            return false;
        }
    }

    async count(table, join, column, where = null) {
        let sql;
        if (arguments.length < 2) {
            return false;
        }
        if (!where) {
            where = join;
        }
        let [query, _] = await this.query(this.select_context(table, join, column, where, 'COUNT'));
        if (query && query.length > 0) {
            return query[0]['tmp'];
        } else {
            return 0;
        }
    }

    async max(table, join, column = null, where = null) {
        let [query, _] = await this.query(this.select_context(table, join, column, where, 'MAX'));

        if (query && query.length > 0) {
            return +query[0]['tmp'];
        }
        else {
            return false;
        }
    }

    async min(table, join, column = null, where = null) {
        let [query, _] = await this.query(this.select_context(table, join, column, where, 'MIN'));

        if (query && query.length > 0) {
            return +query[0]['tmp'];
        }
        else {
            return false;
        }
    }

    async avg(table, join, column = null, where = null) {
        let [query, _] = await this.query(this.select_context(table, join, column, where, 'AVG'));

        if (query && query.length > 0) {
            return +query[0]['tmp'];
        }
        else {
            return false;
        }
    }

    async sum(table, join, column = null, where = null) {
        let [query, _] = await this.query(this.select_context(table, join, column, where, 'SUM'));

        if (query && query.length > 0) {
            return +query[0]['tmp'];
        }
        else {
            return false;
        }
    }

    async alter(table, action, column) {
        let sql = 'ALTER TABLE ' + this.table_escape(table);
        if (action === "drop") {       // 删除 alert(t, 'drop');
            sql += ' DROP ' + this.column_escape(column) + ';';
        } else if (action == "add" && column['column']) {       // 增加 alert(t, c, {add: ['int', '...']});
            sql += ' ADD ' + this.column_escape(column['column']);
            if (column['type']) {
                sql += ' ' + column['type'];
            } else {
                sql += ' ' + 'varchar(32)';
            }

            if (column['unsigned']) {
                sql += ' ' + 'UNSIGNED';
            }

            if (column['null']) {
                sql += ' ' + 'NULL';
            } else {
                sql += ' ' + 'NOT NULL';
            }

            if (column['default'] !== undefined) {
                sql += ' ' + 'DEFAULT ' + this.escape(column['default']);
            }

            if (column['comment']) {
                sql += ' ' + 'COMMENT ' + this.escape(column['comment']);
            }
            sql += ';';
        }
        let result = await this.execute(sql);
        if (result && result[0]) {
            return true;
        } else {
            return false;
        }
    }

    async action(actions) {
        if (Object.prototype.toString.call(actions) === '[object Function]') {
            this.connection.connection.beginTransaction();

            let result = await actions(this);

            if (result === false) {
                this.connection.connection.rollback();
                return false;
            }
            else {
                this.connection.connection.commit();
                return true;
            }
        }
        else {
            return false;
        }
    }
}





module.exports = Medoo;