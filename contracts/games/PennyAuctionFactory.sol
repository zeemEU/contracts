pragma solidity ^0.4.0;
import "./PennyAuction.sol";
import "../roles/UsingPennyAuctionController.sol";
import "../roles/UsingTreasury.sol";

//@createInterface
contract PennyAuctionFactory is
    UsingPennyAuctionController,
    UsingTreasury
{
    PennyAuction public lastCreatedAuction;

    event AuctionCreated(
        uint time,
        address addr,
        uint initialPrize,
        uint bidPrice,
        uint bidAddBlocks,
        uint bidFeePct,
        uint initialBlocks
    );

    function PennyAuctionFactory(address _registry)
        UsingPennyAuctionController(_registry)
        UsingTreasury(_registry)
    {}

    function createAuction(uint _initialPrize,
	                       uint _bidPrice,
	                       uint _bidAddBlocks,
	                       uint _bidFeePct,
                           uint _initialBlocks)
        fromPennyAuctionController
        payable
        returns (PennyAuction _auction)
    {
        require(msg.value == _initialPrize);

        // create an auction, event, and return.
        // throws if invalid params are passed.
		_auction = (new PennyAuction).value(_initialPrize)({
            _collector: address(getTreasury()),
            _initialPrize: _initialPrize,
            _bidPrice: _bidPrice,
            _bidAddBlocks: _bidAddBlocks,
            _bidFeePct: _bidFeePct,
            _initialBlocks: _initialBlocks
        });
        lastCreatedAuction = _auction;

        AuctionCreated({
            time: now,
            addr: _auction,
            initialPrize: _initialPrize,
            bidPrice: _bidPrice,
            bidAddBlocks: _bidAddBlocks,
            bidFeePct: _bidFeePct,
            initialBlocks: _initialBlocks
        });

        return _auction;
    }
}