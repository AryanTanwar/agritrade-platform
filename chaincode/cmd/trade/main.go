// cmd/trade — binary entry point for the AgriTrade TradeContract chaincode.
package main

import (
	"log"

	"github.com/agritrade/chaincode/trade"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cc, err := contractapi.NewChaincode(&trade.SmartContract{})
	if err != nil {
		log.Fatalf("Error creating trade chaincode: %v", err)
	}

	cc.Info.Title = "AgriTrade — TradeContract"
	cc.Info.Version = "1.0.0"
	cc.Info.Description = "Farm produce listing and order management on Hyperledger Fabric"
	cc.Info.Contact.Name = "AgriTrade Engineering"

	if err := cc.Start(); err != nil {
		log.Fatalf("Error starting trade chaincode: %v", err)
	}
}
