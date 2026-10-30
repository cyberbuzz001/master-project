set -e
echo '=== Deploying server dist to containers ==='
for c in tradegrow_app_1 tradegrow_app_2 tradegrow_app_3 tradegrow_app_4; do
  echo Updating $c...
  docker cp /tmp/server_dist.tar.gz ${c}:/tmp/server_dist.tar.gz
  docker exec -i $c tar -xzf /tmp/server_dist.tar.gz -C /app/server/dist/
done

echo '=== Rolling restart containers ==='
for c in tradegrow_app_1 tradegrow_app_2 tradegrow_app_3 tradegrow_app_4; do
  echo Restarting $c...
  docker restart $c
  sleep 4
done

echo '=== Deployment complete ==='
