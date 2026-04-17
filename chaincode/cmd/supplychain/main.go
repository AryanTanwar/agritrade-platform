// cmd/supplychain — binary entry point for the AgriTrade SupplyChainContract chaincode.
package main

import (
	"log"

	"github.com/agritrade/chaincode/supplychain"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cc, err := contractapi.NewChaincode(&supplychain.SmartContract{})
	if err != nil {
		log.Fatalf("Error creating supplychain chaincode: %v", err)
	}

	cc.Info.Title = "AgriTrade — SupplyChainContract"
	cc.Info.Version = "1.0.0"
	cc.Info.Description = "Immutable farm-to-buyer supply-chain provenance events"
	cc.Info.Contact.Name = "AgriTrade Engineering"

	if err := cc.Start(); err != nil {
		log.Fatalf("Error starting supplychain chaincode: %v", err)
	}
}
