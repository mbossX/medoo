const Setting = {
    host: 'localhost',
    port: 3306,
    database: 'terraria',
    user: 'terraria',
    password: '04140906',
    debug_mode: true
}
const Medoo = require('./medoo');
let assert = require('assert');
require('should');
var medoo;

describe('should setup without error', function () {
    it('connection is not null', async function () {
        medoo = new Medoo(Setting);
        await medoo.setup();
        assert(medoo.connection);
    });
});

describe('Select', function () {
    it('select all from Users and first item`s Username == endless', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', "*");
        assert(result);
        assert(result[0]);
        assert(result[0].Username);
        result[0].Username.should.equal('endless');
    });
    it('select all from Users where Usergroup == default', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', "*", { UserGroup: 'default' });
        assert(result);
    });
    it('select all from Users where Usergroup != default', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', "*", { "UserGroup[!]": 'default' });
        assert(result);
    });
    it('select all from Users where ID > 10', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', "*", { "ID[>]": 10 });
        assert(result);
    });
    it('select all from Users where ID >= 10', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', "*", { "ID[>=]": 10 });
        assert(result);
    });
    it('select all from Users and format result', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users', ['ID',{user: ['Username', 'Usergroup']}]);
        assert(result);
        assert(result[0]);
        assert(result[0].user);
        result[0].ID.should.equal(1);
        result[0].user.Username.should.equal('endless');
    });
    it('select all from Users left join tsCharacter where tsCharacter.Health >= 100', async function () {
        assert(medoo.connection);
        let result = await medoo.select('Users(u)', { "[>]tsCharacter(tc)": {"ID": "Account"}}, ['u.Username', 'tc.Health'], { "tc.Health[>]": 100 });
        assert(result);
        assert(result[0]);
        assert(result[0].Username);
        assert(result[0].Health>100);
    });
});
