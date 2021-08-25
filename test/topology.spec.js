const _ = require('lodash');
const should = require('chai').should();
const Broker = require('..');
const url = 'amqp://localhost';
const common = require('./common');

describe('topology should: ', function () {
    let broker;

    afterEach(async function () {
        await common.cleanup(broker);
    });

    it('accept section overrides', async function () {
        broker = new Broker({
            url,
            queues: {
                test: {
                    name: 'test',
                    exchange: { name: 'test' }
                }
            }
        });

        await broker.initQueue('test', {
            queueName: 'custom-name',
            sectionOverride: {
                exchange: {
                    name: 'custom-exchange-name'
                }
            }
        }).consume(x => x);

        let response = await common.getFromApi('exchanges');
        let exchangeNames = response.map(x => x.name);
        exchangeNames.should.include('custom-exchange-name', exchangeNames);
        exchangeNames.should.not.include('test');
    });

    it('build and bind nested dead-letter queues', async function () {
        broker = new Broker({
            url,
            queues: {
                test: {
                    name: 'main',
                    deadLetter: {
                        dlx: 'retry-main-exchange',
                        dlq: 'retry-main',
                        deadLetter: {
                            dlx: 'failed-main-exchange',
                            dlq: 'failed-main',
                        },
                    },
                    exchange: {
                        name: 'main-x',
                        type: 'fanout'
                    }
                },
            }
        });

        await broker.initQueue('test').consume(x => x);

        let exchanges = await common.getFromApi('exchanges');
        let queues = await common.getFromApi('queues');

        let exchangeNamess = exchanges.map(x => x.name);
        exchangeNamess.should.include('main-x', exchangeNamess);
        exchangeNamess.should.include('retry-main-exchange', exchangeNamess);
        exchangeNamess.should.include('failed-main-exchange', exchangeNamess);

        let queueNamess = queues.map(x => x.name);
        queueNamess.should.include('main', exchangeNamess);
        queueNamess.should.include('retry-main', exchangeNamess);
        queueNamess.should.include('failed-main', exchangeNamess);

        let mainQueue = queues.find(x => x.name === 'main');
        mainQueue.arguments.should.include({ "x-dead-letter-exchange": "retry-main-exchange" });

        let retryQueue = queues.find(x => x.name === 'retry-main');
        retryQueue.arguments.should.include({ "x-dead-letter-exchange": "failed-main-exchange" });
    });

    it('build and bind dead-letter queues with overrides', async function () {
        broker = new Broker({
            url,
            queues: {
                test: {
                    name: 'main',
                    deadLetter: {
                        dlx: 'retry-main-exchange',
                        dlq: 'retry-main',
                        deadLetter: {
                            dlx: 'failed-main-exchange',
                            dlq: 'failed-main',
                        },
                    },
                    exchange: {
                        name: 'main-x',
                        type: 'fanout'
                    }
                },
            }
        });

        await broker.initQueue('test').consume(x => x);
        await broker.initQueue('test', { queueName: 'overriden' }).consume(x => x);

        let exchanges = await common.getFromApi('exchanges');
        let queues = await common.getFromApi('queues');

        let exchangeNames = exchanges.map(x => x.name);
        exchangeNames.should.include('main-x', exchangeNames);
        exchangeNames.should.include('retry-main-exchange', exchangeNames);
        exchangeNames.should.include('failed-main-exchange', exchangeNames);

        let queueNames = queues.map(x => x.name);
        queueNames.should.include('main', exchangeNames);
        queueNames.should.include('overriden', exchangeNames);
        queueNames.should.include('retry-main', exchangeNames);
        queueNames.should.include('failed-main', exchangeNames);

        let mainQueue = queues.find(x => x.name === 'main');
        mainQueue.arguments.should.include({ "x-dead-letter-exchange": "retry-main-exchange" });

        let overridenQueue = queues.find(x => x.name === 'overriden');
        overridenQueue.arguments.should.include({ "x-dead-letter-exchange": "retry-main-exchange" });

        let retryQueue = queues.find(x => x.name === 'retry-main');
        retryQueue.arguments.should.include({ "x-dead-letter-exchange": "failed-main-exchange" });
    });

    it('publish and consume on the same queue-adapter should use separate channels and separate connections', async function () {
        //TODO
    });
});
