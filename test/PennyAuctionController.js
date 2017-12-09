var Registry = artifacts.require("Registry.sol");
var Treasury = artifacts.require("Treasury.sol");
var PennyAuctionController = artifacts.require("PennyAuctionController.sol");
var PennyAuctionFactory = artifacts.require("PennyAuctionFactory.sol");
var PennyAuction = artifacts.require("PennyAuction.sol");
var UnpayableBidder = artifacts.require("./test-helpers/UnpayableBidder.sol");

const createDefaultTxTester = require("../js/tx-tester/tx-tester.js")
    .createDefaultTxTester.bind(null, web3, assert, it);
const testUtil = createDefaultTxTester().plugins.testUtil;
const BigNumber = web3.toBigNumber(0).constructor;


const SUMMARY_0        = "First Auction";
const INITIAL_PRIZE_0  = new BigNumber(.05e18);
const BID_PRICE_0      = new BigNumber(.001e18);
const BID_ADD_BLOCKS_0 = new BigNumber(2);
const BID_FEE_PCT_0    = new BigNumber(60);
const INITIAL_BLOCKS_0 = new BigNumber(10);
const DEF_0 = [SUMMARY_0, INITIAL_PRIZE_0, BID_PRICE_0, BID_ADD_BLOCKS_0, BID_FEE_PCT_0, INITIAL_BLOCKS_0];
const FEE_INCR_0 = BID_PRICE_0.mul(BID_FEE_PCT_0.div(100));
const BID_INCR_0 = BID_PRICE_0.minus(FEE_INCR_0);

const SUMMARY_1        = "Second Auction (Invalid BID_ADD_BLOCKS_1)";
const INITIAL_PRIZE_1  = new BigNumber(.04e18);
const BID_PRICE_1      = new BigNumber(.001e18);
const BID_ADD_BLOCKS_1 = new BigNumber(0);
const BID_FEE_PCT_1    = new BigNumber(30);
const INITIAL_BLOCKS_1 = new BigNumber(5);
const DEF_1 = [SUMMARY_1, INITIAL_PRIZE_1, BID_PRICE_1, BID_ADD_BLOCKS_1, BID_FEE_PCT_1, INITIAL_BLOCKS_1];
const FEE_INCR_1 = BID_PRICE_1.mul(BID_FEE_PCT_1.div(100));
const BID_INCR_1 = BID_PRICE_1.minus(FEE_INCR_1);

const SUMMARY_2        = "Third Auction";
const INITIAL_PRIZE_2  = new BigNumber(.03e18);
const BID_PRICE_2      = new BigNumber(.001e18);
const BID_ADD_BLOCKS_2 = new BigNumber(2);
const BID_FEE_PCT_2    = new BigNumber(30);
const INITIAL_BLOCKS_2 = new BigNumber(35);
const DEF_2 = [SUMMARY_2, INITIAL_PRIZE_2, BID_PRICE_2, BID_ADD_BLOCKS_2, BID_FEE_PCT_2, INITIAL_BLOCKS_2];
const FEE_INCR_2 = BID_PRICE_2.mul(BID_FEE_PCT_2.div(100));
const BID_INCR_2 = BID_PRICE_2.minus(FEE_INCR_2);

const SUMMARY_3        = "Fourth Auction (Use UnpayableBidder)";
const INITIAL_PRIZE_3  = new BigNumber(.03e18);
const BID_PRICE_3      = new BigNumber(.001e18);
const BID_ADD_BLOCKS_3 = new BigNumber(2);
const BID_FEE_PCT_3    = new BigNumber(30);
const INITIAL_BLOCKS_3 = new BigNumber(5);
const DEF_3 = [SUMMARY_3, INITIAL_PRIZE_3, BID_PRICE_3, BID_ADD_BLOCKS_3, BID_FEE_PCT_3, INITIAL_BLOCKS_3];
const FEE_INCR_3 = BID_PRICE_3.mul(BID_FEE_PCT_3.div(100));
const BID_INCR_3 = BID_PRICE_3.minus(FEE_INCR_3);


const accounts = web3.eth.accounts;
const NO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe('PennyAuctionController', function(){
    var registry;
    var treasury;
    var pac;
    var paf;
    
    const admin = accounts[1];
    const dummyMainController = accounts[2];
    const bidder1 = accounts[3];
    const bidder2 = accounts[4];
    const auctionWinner = accounts[5];
    const notMainController = accounts[6];
    const nonAdmin = accounts[7];

    before("Set up registry and treasury", async function(){
        registry = await Registry.new();
        treasury = await Treasury.new(registry.address);
        pac = await PennyAuctionController.new(registry.address);
        paf = await PennyAuctionFactory.new(registry.address);
        await registry.register("ADMIN", admin);
        await registry.register("TREASURY", treasury.address);
        await registry.register("MAIN_CONTROLLER", dummyMainController);
        await registry.register("PENNY_AUCTION_CONTROLLER", pac.address);
        await registry.register("PENNY_AUCTION_FACTORY", paf.address);
        const addresses = {
            registry: registry.address,
            treasury: treasury.address,
            pac: pac.address,
            paf: paf.address,
            dummyMainController: dummyMainController,
            bidder1: bidder1,
            bidder2: bidder2,
            auctionWinner: auctionWinner,
            NO_ADDRESS: NO_ADDRESS
        };
        createDefaultTxTester().nameAddresses(addresses).start();
        console.log("Addresses:", addresses);
    });

    it("should be instantiated with proper settings", async function(){
        return createDefaultTxTester()
            .assertStateAsString(pac, "getAdmin", admin, "sees correct admin")
            .assertStateAsString(pac, "getPennyAuctionFactory", paf.address, "sees correct PAF")
            .start();
    });

    describe(".editDefinedAuction()", async function(){
        it("Cannot edit from non-admin", async function(){
            const callParams = [pac, "editDefinedAuction", 0].concat(DEF_0, {from: nonAdmin})
            return createDefaultTxTester()
                .assertCallThrows(callParams)
                .doTx(callParams)
                .assertInvalidOpCode()
                .start()
        })
        it("Cannot edit with too high of an index", async function(){
            const callParams = [pac, "editDefinedAuction", 1].concat(DEF_0, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, false)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyErrorLog("Index out of bounds.")
                .start()
        });
        it("Adds definedAuction correctly", async function(){
            const callParams = [pac, "editDefinedAuction", 0].concat(DEF_0, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 0})
                .assertStateAsString(pac, "numDefinedAuctions", 1)
                .assertCallReturns([pac, "definedAuctions", 0], [
                    false,
                    "0x0000000000000000000000000000000000000000"].concat(DEF_0))
                .start()
        });
        it("Cannot edit with too high an index", async function(){
            const callParams = [pac, "editDefinedAuction", 2].concat(DEF_1, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, false)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyErrorLog("Index out of bounds.")
                .start()
        });
        it("Adds another definedAuction correctly", async function(){
            const callParams = [pac, "editDefinedAuction", 1].concat(DEF_1, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 1})
                .assertStateAsString(pac, "numDefinedAuctions", 2)
                .assertCallReturns([pac, "definedAuctions", 1], [
                    false,
                    "0x0000000000000000000000000000000000000000"].concat(DEF_1))
                .start()
        });
        it("Adds another definedAuction correctly", async function(){
            const callParams = [pac, "editDefinedAuction", 2].concat(DEF_2, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 2})
                .assertStateAsString(pac, "numDefinedAuctions", 3)
                .assertCallReturns([pac, "definedAuctions", 2], [
                    false,
                    "0x0000000000000000000000000000000000000000"].concat(DEF_2))
                .start()
        });
        it("Adds another definedAuction correctly", async function(){
            const callParams = [pac, "editDefinedAuction", 3].concat(DEF_3, {from: admin});
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 3})
                .assertStateAsString(pac, "numDefinedAuctions", 4)
                .assertCallReturns([pac, "definedAuctions", 3], [
                    false,
                    "0x0000000000000000000000000000000000000000"].concat(DEF_3))
                .start()
        });
    });

    describe(".enableDefinedAuction()", function(){
        before("definedAuctions exist", async function(){
            assert.strEqual(await pac.numDefinedAuctions(), 4);
            assert.strEqual(await pac.getIsEnabled(0), false);
        });
        it("is only callable by admin", function(){
            const callParams = [pac, "enableDefinedAuction", 0, {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallThrows(callParams)
                .doTx(callParams)
                .assertInvalidOpCode()
                .start();
        });
        it("Fails if index too high", function(){
            const callParams = [pac, "enableDefinedAuction", 4, {from: admin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, false)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyErrorLog("Index out of bounds.")
                .start();
        });
        it("Works", function(){
            const callParams = [pac, "enableDefinedAuction", 0, {from: admin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 0})
                .assertAsString(() => pac.getIsEnabled(0), true, "isEnabled is true")
                .assertStateAsString(pac, "numDefinedAuctions", 4)
                .start();
        });
    });

    describe(".disabledDefinedAuction()", function(){
        before("definedAuctions exist", async function(){
            assert.strEqual(await pac.numDefinedAuctions(), 4);
            assert.strEqual(await pac.getIsEnabled(0), true);
        });
        it("is only callable by admin", function(){
            const callParams = [pac, "disableDefinedAuction", 0, {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallThrows(callParams)
                .doTx(callParams)
                .assertInvalidOpCode()
                .start();
        });
        it("Fails if index too high", function(){
            const callParams = [pac, "disableDefinedAuction", 4, {from: admin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, false)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyErrorLog("Index out of bounds.")
                .start();
        });
        it("Works", function(){
            const callParams = [pac, "disableDefinedAuction", 0, {from: admin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, true)
                .doTx(callParams)
                .assertSuccess()
                .assertOnlyLog("DefinedAuctionEdited", {time: null, index: 0})
                .assertAsString(() => pac.getIsEnabled(0), false,
                    "isEnabled is now false")
                .assertStateAsString(pac, "numDefinedAuctions", 4)
                .start();
        }); 
    });

    describe(".startDefinedAuction()", function(){
        before("enable some auctions", async function(){
            assert.strEqual(await pac.numDefinedAuctions(), 4);
            await pac.enableDefinedAuction(0, {from: admin});
            await pac.disableDefinedAuction(1, {from: admin});
            await pac.enableDefinedAuction(2, {from: admin});
            await pac.enableDefinedAuction(3, {from: admin});
        });
        it("refunds when index out of bounds", function(){
            const callParams = [pac, "startDefinedAuction", 5, {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [false, NO_ADDRESS])
                .startLedger([nonAdmin, pac])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyErrorLog("Index out of bounds.")
                .stopLedger()
                    .assertLostTxFee(nonAdmin)
                    .assertNoDelta(pac)
                .start();
        });
        it("refunds when not enabled", function(){
            const callParams = [pac, "startDefinedAuction", 1, {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [false, NO_ADDRESS])
                .startLedger([nonAdmin, pac])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyErrorLog("DefinedAuction is not enabled.")
                .stopLedger()
                    .assertLostTxFee(nonAdmin)
                    .assertNoDelta(pac)
                .start();
        });
        it("refunds when incorrect ETH sent", function(){
            const callParams = [pac, "startDefinedAuction", 0, {from: nonAdmin, value: 1}]
            return createDefaultTxTester()
                .assertCallReturns(callParams, [false, NO_ADDRESS])
                .startLedger([nonAdmin, pac])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyErrorLog("Value sent does not match initialPrize.")
                .stopLedger()
                    .assertLostTxFee(nonAdmin)
                    .assertNoDelta(pac)
                .start();
        });
        it("refunds when starting auction with bad params", function(){
            const callParams = [pac, "startDefinedAuction", 1, {from: nonAdmin, value: INITIAL_PRIZE_1}];
            return createDefaultTxTester()
                .doTx([pac, "enableDefinedAuction", 1, {from: admin}])
                .assertCallThrows(callParams)
                .startLedger([nonAdmin, pac])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyErrorLog("PennyAuctionFactory could not create auction (invalid params?)")
                .stopLedger()
                    .assertLostTxFee(nonAdmin)
                    .assertNoDelta(pac)
                .doTx([pac, "disableDefinedAuction", 1, {from: admin}])
                .start();
        });
        it("works", async function(){
            var auction;
            const callParams = [pac, "startDefinedAuction", 0, {from: nonAdmin, value: INITIAL_PRIZE_0}];
            await createDefaultTxTester()
                .assertCallReturns(callParams, [true, null])
                .startLedger([nonAdmin, pac])
                .startWatching([paf])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyLog("AuctionStarted", {time: null, addr: null})
                .stopLedger()
                    .assertNoDelta(pac)
                .stopWatching()
                    .assertEvent(paf, "AuctionCreated", {
                        time: null,
                        addr: null,
                        initialPrize: INITIAL_PRIZE_0,
                        bidPrice: BID_PRICE_0,
                        bidAddBlocks: BID_ADD_BLOCKS_0,
                        bidFeePct: BID_FEE_PCT_0,
                        initialBlocks: INITIAL_BLOCKS_0
                    })
                .doFn((ctx) => { auction = PennyAuction.at(ctx.txRes.logs[0].args.addr) })
                    .assertAsString(() => pac.getAuction(0), () => auction.address,
                        "definedAuctions.auction is set correctly")
                    .assertAsString(() => auction.prize(), INITIAL_PRIZE_0,
                        "created auction has correct initialPrize")
                    .assertAsString(() => auction.bidPrice(), BID_PRICE_0,
                        "created auction has correct bidPrice")
                    .assertAsString(() => auction.bidAddBlocks(), BID_ADD_BLOCKS_0,
                        "created auction has correct biddAddBlocks")
                    .assertAsString(() => auction.bidFeePct(), BID_FEE_PCT_0,
                        "created auction has correct bidFeePct")
                    .assertAsString(() => auction.currentWinner(), treasury.address,
                        "created auction currentWinner is treasury")
                .start();
            await createDefaultTxTester().nameAddresses({auction0: auction}, false).start();
        });
        it("refunds when already started", function(){
            const callParams = [pac, "startDefinedAuction", 0, {from: nonAdmin, value: INITIAL_PRIZE_1}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [false, NO_ADDRESS])
                .startLedger([nonAdmin, pac])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyErrorLog("Auction is already started.")
                .stopLedger()
                    .assertLostTxFee(nonAdmin)
                    .assertNoDelta(pac)
                .start();
        });
        it("Starts another", async function(){
            var auction;
            const callParams = [pac, "startDefinedAuction", 2, {from: nonAdmin, value: INITIAL_PRIZE_2}];
            await createDefaultTxTester()
                .assertCallReturns(callParams, [true, null])
                .startLedger([nonAdmin, pac])
                .startWatching([paf])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyLog("AuctionStarted", {time: null, addr: null})
                .stopLedger()
                    .assertNoDelta(pac)
                .stopWatching()
                    .assertEvent(paf, "AuctionCreated", {
                        time: null,
                        addr: null,
                        initialPrize: INITIAL_PRIZE_2,
                        bidPrice: BID_PRICE_2,
                        bidAddBlocks: BID_ADD_BLOCKS_2,
                        bidFeePct: BID_FEE_PCT_2,
                        initialBlocks: INITIAL_BLOCKS_2
                    })
                .doFn((ctx) => { auction = PennyAuction.at(ctx.txRes.logs[0].args.addr) })
                    .assertAsString(() => pac.getAuction(2), () => auction.address,
                        "definedAuctions.auction is set correctly")
                    .assertAsString(() => auction.prize(), INITIAL_PRIZE_2,
                        "created auction has correct initialPrize")
                    .assertAsString(() => auction.bidPrice(), BID_PRICE_2,
                        "created auction has correct bidPrice")
                    .assertAsString(() => auction.bidAddBlocks(), BID_ADD_BLOCKS_2,
                        "created auction has correct biddAddBlocks")
                    .assertAsString(() => auction.bidFeePct(), BID_FEE_PCT_2,
                        "created auction has correct bidFeePct")
                    .assertAsString(() => auction.currentWinner(), treasury.address,
                        "created auction currentWinner is treasury")
                .start();

            await createDefaultTxTester().nameAddresses({auction2: auction}, false).start();
        });
    });

    describe(".getIsStartable()", function(){
        before("Ensure state", async function(){
            // auction0 is started
            assert.notEqual(await pac.getAuction(0), NO_ADDRESS);
            // auction1 is disabled
            assert.equal(await pac.getAuction(1), NO_ADDRESS);
            assert.equal(await pac.getIsEnabled(1), false);
            // auction2 is started
            assert.notEqual(await pac.getAuction(2), NO_ADDRESS);
            // auction3 is enabled and not started
            assert.equal(await pac.getAuction(3), NO_ADDRESS);
            assert.equal(await pac.getIsEnabled(3), true);
        });
        it("Returns correct values", function(){
            return createDefaultTxTester()
                .assertCallReturns([pac, "getIsStartable", 0], [false,0])
                .assertCallReturns([pac, "getIsStartable", 1], [false,0])
                .assertCallReturns([pac, "getIsStartable", 2], [false,0])
                .assertCallReturns([pac, "getIsStartable", 3], [true,INITIAL_PRIZE_3])
                .assertCallReturns([pac, "getIsStartable", 4], [false,0])
                .start();
        })
    });

    // At this point, definedAuctions[1] is started
    describe("With active auctions", async function(){
        var auction0;
        var auction2;
        before("There are open auctions", async function(){
            auction0 = PennyAuction.at(await pac.getAuction(0));
            assert.notEqual(auction0.address, NO_ADDRESS);
            auction2 = PennyAuction.at(await pac.getAuction(2));
            assert.notEqual(auction2.address, NO_ADDRESS);
        });
        it("Bids on auctions twice", async function(){
            await auction0.sendTransaction({from: bidder1, value: BID_PRICE_0});
            await auction0.sendTransaction({from: bidder2, value: BID_PRICE_0});
            await auction2.sendTransaction({from: bidder2, value: BID_PRICE_2});
            await auction2.sendTransaction({from: bidder1, value: BID_PRICE_2});
        });
        it(".getAvailableFees() returns expectd amount", async function(){
            const expectedFees = FEE_INCR_0.mul(2).plus(FEE_INCR_2.mul(2));
            return createDefaultTxTester()
                .assertCallReturns([pac, "getAvailableFees"], expectedFees)
                .start();
        });
        it(".getNumEndedAuctions() is zero", async function(){
            return createDefaultTxTester()
                .assertCallReturns([pac, "getNumEndedAuctions"], 0)
                .start();
        });
        it(".getActiveAuctions() returns two of them", async function(){
            const callParams = [pac, "getActiveAuctions"];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [auction0.address, auction2.address])
                .start();
        });
        it(".refreshAuctions() collects fees, ends no games", async function(){
            const fees0 = FEE_INCR_0.mul(2);
            const fees2 = FEE_INCR_2.mul(2);
            const totalFees = fees0.plus(fees2);
            const callParams = [pac, "refreshAuctions", {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [0, totalFees])
                .startLedger([treasury])
                .startWatching([auction0, auction2])
                .doTx(callParams)
                .assertSuccess()
                    .assertLog("FeeCollectionSuccess", {
                        time: null,
                        amount: totalFees
                    })
                .stopLedger()
                    .assertDelta(treasury, totalFees)
                .stopWatching()
                    .assertEvent(auction0, "FeeCollectionSuccess", {
                        time: null,
                        amount: fees0
                    })
                    .assertEvent(auction2, "FeeCollectionSuccess", {
                        time: null,
                        amount: fees2
                    })
                .assertStateAsString(pac, "totalFees", totalFees)
                .assertStateAsString(auction0, "fees", 0)
                .assertStateAsString(auction2, "fees", 0)
                .assertStateAsString(auction0, "isPaid", false)
                .assertStateAsString(auction2, "isPaid", false)
                .start();
        });
        it(".refreshAuctions() collects no fees, ends no games", async function(){
            const callParams = [pac, "refreshAuctions", {from: nonAdmin}];
            const expectedFees = await pac.totalFees();
            return createDefaultTxTester()
                .assertCallReturns(callParams, [0, 0])
                .startLedger([treasury])
                .doTx(callParams)
                .assertSuccess()
                    .assertLogCount(0)
                .stopLedger()
                    .assertNoDelta(treasury)
                .assertStateAsString(pac, "totalFees", expectedFees)
                .start(); 
        });
    });

    describe("When an auction ends", function(){
        var auction0;
        before("Fast forwards until an auction is ended", async function(){
            auction0 = PennyAuction.at(await pac.getAuction(0));
            assert.notEqual(auction0.address, NO_ADDRESS);
            const auction2 = PennyAuction.at(await pac.getAuction(2));
            assert.notEqual(auction2.address, NO_ADDRESS);
            const blocksRemaining0 = (await auction0.getBlocksRemaining()).toNumber();
            const blocksRemaining2 = (await auction2.getBlocksRemaining()).toNumber();

            // set auctionIndex, auction, and fast forward
            console.log(`Blocks left: auction0: ${blocksRemaining0}, auction2: ${blocksRemaining2}`);
            if (blocksRemaining2 - blocksRemaining0 < 20){
                throw new Error("Should be set up so auction0 ends long before auction2 other...");
            }
            const blocksToMine = blocksRemaining0;
            console.log(`Mining ${blocksToMine} blocks so auction0 ends...`);
            await testUtil.mineBlocks(blocksToMine);
        });
        it(".getNumEndedAuctions() should return 1", async function(){
            const callParams = [pac, "getNumEndedAuctions", {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, 1)
                .start();
        });
        it(".refreshAuctions() returns 1 auction ended, and 0 fees collected", async function(){
            const callParams = [pac, "refreshAuctions", {from: nonAdmin}];
            const winner = await auction0.currentWinner();
            const prize = await auction0.prize();
            const expectedFees = await pac.totalFees();
            const expectedBids = await auction0.numBids();
            const expectedPrizes = await auction0.prize()
            return createDefaultTxTester()
                .assertCallReturns(callParams, [1, 0])
                .startLedger([pac, winner])
                .startWatching([auction0])
                .doTx(callParams)
                .assertSuccess()
                    .assertOnlyLog("AuctionEnded", {
                        time: null,
                        index: 0,
                        addr: auction0.address
                    })
                .stopLedger()
                    .assertDelta(winner, prize)
                    .assertNoDelta(pac)
                .stopWatching()
                    .assertEvent(auction0, "PaymentSuccess", {
                        time: null,
                        redeemer: pac.address,
                        recipient: winner,
                        amount: prize,
                        gasLimit: 2300
                    })
                .assertCallReturns([pac, "getAuction", 0], NO_ADDRESS)
                .assertCallReturns([pac, "endedAuctions", 0], auction0.address)
                .assertStateAsString(pac, "numEndedAuctions", 1)
                .assertStateAsString(pac, "totalFees", expectedFees)
                .assertStateAsString(pac, "totalBids", expectedBids)
                .assertStateAsString(pac, "totalPrizes", expectedPrizes)
                .assertStateAsString(auction0, "isPaid", true)
                .start()
        });
        it(".refreshAuctions() returns 0 auctions ended, and 0 fees collected", async function(){
            const expectedFees = await pac.totalFees();
            const expectedBids = await pac.totalBids();
            const expectedPrizes = await pac.totalPrizes();
            const callParams = [pac, "refreshAuctions", {from: nonAdmin}];
            return createDefaultTxTester()
                .assertCallReturns(callParams, [0, 0])
                .doTx(callParams)
                .assertSuccess()
                    .assertLogCount(0)
                .assertStateAsString(pac, "totalFees", expectedFees)
                .assertStateAsString(pac, "totalBids", expectedBids)
                .assertStateAsString(pac, "totalPrizes", expectedPrizes)
                .start()
        });
    });

    // Should still end auction as expected, and shouldn't stall controller
    describe("Auction with an unpayable winner", async function(){
        var unpayableBidder;
        var auction2;
        before("Bid on auction2 with UnpayableBidder, end it...", async function(){
            // create unpayableBidder
            unpayableBidder = await UnpayableBidder.new();
            await unpayableBidder.fund({value: BID_PRICE_2.mul(2)});
            assert.strEqual(await testUtil.getBalance(unpayableBidder), BID_PRICE_2.mul(2));
            // bid on auction2
            auction2 = PennyAuction.at(await pac.getAuction(2));
            assert.notEqual(auction2.address, NO_ADDRESS);
            await unpayableBidder.doBid(auction2.address);
            assert.strEqual(await auction2.currentWinner(), unpayableBidder.address);
            // fast-forward
            const blocksRemaining = await auction2.getBlocksRemaining();
            testUtil.mineBlocks(blocksRemaining);
            // add addresses
            await createDefaultTxTester().nameAddresses({
                auction2: auction2.address,
                unpayableBidder: unpayableBidder.address
            }, false).start();
            console.log(`Started auction2, bid with unpayableBidder, fast forwarded ${blocksRemaining}`);
        });
        it(".refreshAuctions() ends auction, collects fees, but doesnt pay unpayableBidder", async function(){
            const callParams = [pac, "refreshAuctions", {from: nonAdmin}];
            const prize = await auction2.prize();
            const feesCollected = await auction2.fees();
            const expectedFees = (await pac.totalFees()).plus(feesCollected);
            const expectedBids = (await pac.totalBids()).plus(await auction2.numBids());
            const expectedPrizes = (await pac.totalPrizes()).plus(await auction2.prize());
            return createDefaultTxTester()
                .assertCallReturns(callParams, [1, await auction2.fees()])
                .startLedger([pac, unpayableBidder, treasury])
                .startWatching([auction2])
                .doTx(callParams)
                .assertSuccess()
                    .assertLogCount(2)
                    .assertLog("AuctionEnded", {
                        time: null,
                        index: 2,
                        addr: auction2.address
                    })
                    .assertLog("FeeCollectionSuccess", {
                        time: null,
                        amount: feesCollected
                    })
                .stopLedger()
                    .assertDelta(treasury, feesCollected)
                    .assertNoDelta(unpayableBidder)
                    .assertNoDelta(pac)
                .stopWatching()
                    .assertEvent(auction2, "FeeCollectionSuccess", {
                        time: null,
                        amount: feesCollected
                    })
                    .assertEvent(auction2, "PaymentFailure", {
                        time: null,
                        redeemer: pac.address,
                        recipient: unpayableBidder.address,
                        amount: prize,
                        gasLimit: 2300
                    })
                .assertCallReturns([pac, "getAuction", 2], NO_ADDRESS)
                .assertCallReturns([pac, "endedAuctions", 1], auction2.address)
                .assertStateAsString(pac, "numEndedAuctions", 2)
                .assertStateAsString(pac, "totalFees", expectedFees)
                .assertStateAsString(pac, "totalBids", expectedBids)
                .assertStateAsString(pac, "totalPrizes", expectedPrizes)
                .assertStateAsString(auction2, "isPaid", false)
                .assertStateAsString(auction2, "fees", 0)
                .start()
        });
    });
});