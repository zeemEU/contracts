pragma solidity ^0.4.0;


/*
  A simple Contract that can bid on a PennyAuction. However,
  when it is gets sent Ether it uses a lot of gas.

  This is used to test that PennyAuctions dont fail even if the
  winner is not payable, and that the winner can claim the prize.
*/
interface _IEpbPennyAuction {
    function bidPrice() public constant returns (uint _bidPrice);
    function payWinner(uint _gasLimit) public returns (bool _success, uint _prizeSent);
}
contract ExpensivePayableBidder {
    function doBid(address addr) public {
        _IEpbPennyAuction auction = _IEpbPennyAuction(addr);
        uint _bidPrice = auction.bidPrice();
        require(auction.call.value(_bidPrice)());
    }
    function doRedemption(address addr)
        public
        returns (bool _success, uint _prizeSent)
    {
        _IEpbPennyAuction auction = _IEpbPennyAuction(addr);
        return auction.payWinner(0); 
    }
    function fund() public payable {}
    function () public payable {
        // burn some gas.
        uint bla;
        for (uint i=0; i<2000; i++){
            bla += i;
        }
    }
}