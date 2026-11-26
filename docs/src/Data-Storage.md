## Database

We use Postgres for the database. The database is hosted on Railway. Use docker compose for local Postgres instance.

### Database Model

```mermaid
---
config:
  layout: elk
---
erDiagram
	direction LR
	Building {
		string buildingCode PK ""  
		string name  ""  
		int defaultOrdinal  ""  
		string osmId  ""  
		float labelLatitude  ""  
		float labelLongitude  ""  
		string shape  ""  
		string hitbox  ""  
	}
	Floor {
		string buildingCode PK ""  
		int floorLevel PK ""  
		bool isDefault  ""  
		float centerX  ""  
		float centerY  ""  
		float centerLatitude  ""  
		float centerLongitude  ""  
		float scale  ""  
		float angle  ""  
		float altitude  ""  
	}
	FloorConnection {
	}
	Complex {
		string Name PK ""  
	}
	Room {
		string roomId PK ""  
		string name  ""  
		string type  ""  
		float labelLatitude  ""  
		float labelLongitude  ""  
		string polygon  ""  
	}
	Alias {
		string alias PK ""  
		bool isDisplayAlias  ""  
	}
	Node {
		string nodeId PK ""  
		float latitude  ""  
		float longitude  ""  
	}
	Edge {
	}
	Poi {
		string poiId PK ""  
		string type  ""  
	}

	Building||--o{Floor:"has"
	Floor||--o{FloorConnection:"are connected by"
	Floor||--o{Room:"has"
	%% Floor}o--||Complex:"belongs_to"
	Floor||--o{Node:"has"
	Complex||--o{Room:"has"
	Room||--o{Alias:"has"
	Room||--o{Node:"has"
	Node||--o{Edge:"are connected by"
	Node||--||Poi:"is"
```

### How to access the database

Use PgAdmin, which can connect to the DB through Railway's internal network and limits login retries for safety.

Passwords are stored in Railway. Hosted in the following locations for each environment

- Dev: https://pgadmin.maps.slabs-dev.org/browser/
- Staging: to be set up
- Prod: to be set up

## S3 Bucket

Will created schemas in the dataflow folder.
