// cmd/logistics — binary entry point for the AgriTrade LogisticsContract chaincode.
package main

import (
	"log"

	"github.com/agritrade/chaincode/logistics"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cc, err := contractapi.NewChaincode(&logistics.SmartContract{})
	if err != nil {
		log.Fatalf("Error creating logistics chaincode: %v", err)
	}

	cc.Info.Title = "AgriTrade — LogisticsContract"
	cc.Info.Version = "1.0.0"
	cc.Info.Description = "Real-time shipment tracking with IoT cold-chain monitoring"
	cc.Info.Contact.Name = "AgriTrade Engineering"

	if err := cc.Start(); err != nil {
		log.Fatalf("Error starting logistics chaincode: %v", err)
	}
}
