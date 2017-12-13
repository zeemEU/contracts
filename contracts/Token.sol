pragma solidity ^0.4.11;

contract Token {
	/* STANDARD ERC20 FIELDS */
	string public name = "PennyEther";
	string public symbol = "BID";
	uint8 public decimals = 18;
	uint public totalSupply;
	event Transfer(address indexed from, address indexed to, uint amount);
	event Approval(address indexed owner, address indexed spender, uint amount);

	/* PRIVATE STORAGE AND EVENTS */
	mapping (address => uint) balances;
	mapping (address => mapping (address => uint)) allowed;
	event TransferFrom(address indexed spender, address indexed from, address indexed to, uint amount);

	/* DIVIDENDS */
	// Each time a new deposit is made, totalWeiPerToken is incremented
	// based on the dividendAmount divided by totalSupply.
	// A user is credited Wei based on (totalWeiPerToken - user.lastWeiPerToken)
	// times their current balance, and their lastWeiPerToken is set to totalWeiPerToken.
	// This happens before they send or receive tokens, and if they call .collectDividends()
	uint constant BIG_NUMBER = 1e32;
	uint public totalDividends;
	uint public collectedDividends;
	uint public totalWeiPerToken;
	mapping (address => uint) creditedDividends;
	mapping (address => uint) lastWeiPerToken;
	event CollectDividendsSuccess(address indexed account, uint amount);
	event CollectDividendsFailure(address indexed account, uint amount);
	event DividendReceived(address indexed sender, uint amount);

	/* VOTING TO DISSOLVE */
	uint public totalVotes;
	mapping (address => uint) public numVotes;
	event VotesCast(address indexed sender, uint amount, uint totalVotes);
	event DissolveExecuted();

	/* OWNER STUFF */
	// When true, .mintTokens is callable, and dividends will be rejected.
	bool public isMinting = true;
	// The "admin" account.  Can call .stopMinting and .mintTokens
	address public owner = msg.sender;
	// events
	event StoppedMinting();

	function Token() public {}

	// Upon receiving payment, increment totalWeiPerToken.
	// While minting, reject any dividends.
	function () payable {
		require(!isMinting);
		// BIG_NUMBER is 1e32 -- no overflow unless we get 1e45 wei (1e27 ETH)
		// Also note we divide by totalSupply. (See: getUncreditedDividends)
		totalWeiPerToken += (msg.value * BIG_NUMBER) / totalSupply;
		totalDividends += msg.value;
		DividendReceived(msg.sender, msg.value);
	}

	function stopMinting()
		public
	{
		require(msg.sender == owner);
		require(isMinting);
		isMinting = false;
		StoppedMinting();
	}

	function mintTokens(address _to, uint _amount)
		public
	{
		require(msg.sender == owner);
		require(isMinting);
		totalSupply += _amount;
		balances[_to] += _amount;
	}

	// Updates creditedDividends and token balances.
	function _transfer(address _from, address _to, uint _value)
		private
	{
		// check for overflow and for sufficient funds
		require(balances[_to] + _value > balances[_to]);
		require(balances[_from] >= _value);
		
		// Credit _to and _from with dividends before transferring.
		// See: updatedCreditedDividends() for more info.
		updateCreditedDividends(_to);
		updateCreditedDividends(_from);
		balances[_from] -= _value;
		balances[_to] += _value;
		removeExcessVotes(_from);
		Transfer(_from, _to, _value);
	}

	// Credits _account with whatever dividends they haven't yet been credited.
	// This needs to be called before a user's balance changes to ensure their
	// "lastWeiPerToken" is always accurate.  If this isn't called, a user
	// could simply transfer a large amount of tokens and receive a large dividend
	// (or conversely transfer out tokens and receive no dividend).
	function updateCreditedDividends(address _account)
		private
	{
		creditedDividends[_account] += getUncreditedDividends(_account);
		lastWeiPerToken[_account] = totalWeiPerToken;
	}

	// If the user's numVotes exceeds their balance
	// then remove the surplus amount of votes.
	function removeExcessVotes(address _account)
		private
	{
		if (balances[_account] >= numVotes[_account]) return;
		uint excessVotes = numVotes[_account] - balances[_account];
		numVotes[_account] -= excessVotes;
		totalVotes -= excessVotes;
	}

	// Redeems the dividends owed to the sender.
	function collectDividends()
		public
		returns (bool _success)
	{
		// update creditedDividends, store amount, and zero it.
		updateCreditedDividends(msg.sender);
		uint _amount = creditedDividends[msg.sender];
		creditedDividends[msg.sender] = 0;

		// Try to send to msg.sender using full gas.
		// Rollback on failure.
		if (msg.sender.call.value(_amount)()) {
			collectedDividends += _amount;
			CollectDividendsSuccess(msg.sender, _amount);
			return true;
		} else {
			creditedDividends[msg.sender] = _amount;
			CollectDividendsFailure(msg.sender, _amount);
			return false;
		}
	}

	// Changes the amount of votes a user casts towards dissolving.
	// If _amount exceeds balance, uses entire balance.
	function castVotes(uint _amount)
		public
	{
		uint _balance = balances[msg.sender];
		if (_amount > _balance) _amount = _balance;
		// remove all current votes, replace with new _amount
		totalVotes -= numVotes[msg.sender];
		totalVotes += _amount;
		numVotes[msg.sender] = _amount;
		VotesCast(msg.sender, _amount, totalVotes);
	}

	// Callable by anyone if .hasEnoughVotes() is true.
	// This causes treasury to send all funds to us.
	function executeDissolve()
		public
	{
		require(hasEnoughVotes());
		DissolveExecuted();
	}

	// ERC20
	function transfer(address _to, uint _value)
		public
	{
		_transfer(msg.sender, _to, _value);
	}

	// ERC20
	// Sends _from's tokens to _to, provided msg.spender has an allowance.
	function transferFrom(address _from, address _to, uint256 _value)
		public
		returns (bool success)
	{
		require(allowed[_from][msg.sender] >= _value);
		allowed[_from][msg.sender] -= _value;
		TransferFrom(msg.sender, _from, _to, _value);
		_transfer(_from, _to, _value);
		return true;
	}

	// ERC20
	// Sets an allowance for _spender to spend msg.sender's tokens.
	function approve(address _spender, uint _value)
		public
		returns (bool success)
	{
		allowed[msg.sender][_spender] = _value;
		Approval(msg.sender, _spender, _value);
		return true;
	}

	// ERC20
	// Returns how much of _owner's balance can be spent by _spender
	function allowance(address _owner, address _spender)
		public
		returns (uint remaining)
	{
		return allowed[_owner][_spender];
	}

	// ERC20
	// Returns how many tokens _owner has
	function balanceOf(address _owner)
		constant
		returns (uint balance)
	{
		return balances[_owner];
	}

	// For a given account, returns how many Wei they haven't yet been credited.
	function getUncreditedDividends(address _account)
		private
		constant
		returns (uint _amount)
	{
		// Note: _weiPerToken is at most totalWeiPerToken,
		// and totalWeiPerToken was calculated by dividing by totalSupply.
		// totalSupply is always greater than balances[_account],
		// so _weiPerToken * balances[_account] will never cause an overflow.
		uint _weiPerToken = totalWeiPerToken - lastWeiPerToken[_account];
		return (_weiPerToken * balances[_account]) / BIG_NUMBER;
	}

	// Returns how many wei a call to .collectDividends() would transfer.
	function getCollectableDividends(address _account)
		public
		constant
		returns (uint _amount)
	{
		return getUncreditedDividends(_account) + creditedDividends[_account];
	}

	function hasEnoughVotes()
		public
		constant
		returns (bool)
	{
		return totalVotes > totalSupply/2;
	}
}