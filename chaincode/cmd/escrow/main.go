// cmd/escrow — binary entry point for the AgriTrade EscrowContract chaincode.
package main

import (
	"log"

	"github.com/agritrade/chaincode/escrow"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cc, err := contractapi.NewChaincode(&escrow.SmartContract{})
	if err != nil {
		log.Fatalf("Error creating escrow chaincode: %v", err)
	}

	cc.Info.Title = "AgriTrade — EscrowContract"
	cc.Info.Version = "1.0.0"
	cc.Info.Description = "Payment escrow — hold, release, and refund for trade orders"
	cc.Info.Contact.Name = "AgriTrade Engineering"

	if err := cc.Start(); err != nil {
		log.Fatalf("Error starting escrow chaincode: %v", err)
	}
}
