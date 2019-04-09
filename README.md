# SUZ Lunch scraper

Simple API for scraping `https://agata.suz.cvut.cz/`

## Deployment

```bash
$ yarn
$ yarn global add serverless
$ serverless deploy -v
```

## Endpoints
See the included HTTP Archive file `requests.har`

### GET /list
List of restaurants

```
curl --request GET \
  --url /list \
  --header 'content-type: application/json'
```


### POST /menu 
Get menu of certain restaurant

```
curl --request POST \
  --url /menu \
  --header 'content-type: application/json' \
  --data '{ "id": "[ID of restaurant]" }'
```


### POST /balance
Get the user balance on ISIC

```
curl --request POST \
  --url /balance \
  --header 'content-type: application/json' \
  --data '{
    "username": "[Username]",
    "password": "[Password]"
  }'
```