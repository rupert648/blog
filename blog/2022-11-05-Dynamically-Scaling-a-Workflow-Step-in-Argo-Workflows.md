# Dynamically Scaling a Workflow Step in Argo Workflows

What is Argo

From the Argo Site
> Argo Workflows is an open source container-native workflow engine for orchestrating parallel jobs on Kubernetes

Argo workflows allows you to define through a configuration file a series of steps to run inside a kubernetes cluster. Argo from this configuration will control the sequencing for this as well as orchestrating any parallel operations you define.

When managing many parallel running workflows, argo does all the leg work for you. It will spin up containers to handle the steps you define using the kubernetes API. However this wasn’t what I wanted.

The use case I wanted to achieve for was to dynamically scale a ***single*** ***step*** in a workflow, whilst keeping other steps static.

## Why did I need this Use Case?

A simplification of my use case provided just two steps.

1. A data generation step, which puts the data into a shared database

1. A data pulling step, which pulls the data from the database and performs some processing on the data, before dumping it to a storage solution.

I wanted the data being generated in the first stage to consistently be unique whilst running the node. There are fancy ways to do this whilst running multiple containers but the simplest way to ensure unique data is to just have a single node generating the data.

The second step is what I wanted to scale — I want to make a decision based upon how much data is generated from the first step to decide how many instances of the second step I created. This would allow me to process the data in parallel. This would make the data processing step much quicker.

*Note: A better solution to this issue might be to extract the data production from the workflow, however keeping it inside the workflow itself allowed expandability within my use case as well as the ability to extremely easily orchestrate the whole thing on a CRON job.*

## Installation

To preface the solution, to demo these steps I am running these steps in a local cluster using [Minikube](https://minikube.sigs.k8s.io/docs/start/). To install minikube follow the instructions on their site, or using homebrew.

brew install minikube

Run minikube start to spin up your minikube instance, then run the following to install argo.

kubectl create namespace argo
kubectl apply -n argo -f [https://github.com/argoproj/argo-workflows/releases/download/v](https://github.com/argoproj/argo-workflows/releases/download/v)<<ARGO_WORKFLOWS_VERSION>>/install.yaml

For the writing of this tutorial, I am using **v3.4.2**

You will also need to install the [Argo CLI](https://github.com/argoproj/argo-workflows/releases/tag/v3.4.3)

## The Solution

The solution to this problem I found was to utilise the output parameters you are able to pass through the steps in Argo Workflows. We can use these in conjunction with the withParam attribute to run parallel jobs.

### Output Parameters

Argo provides several forms of functionality for passing output parameters between steps.

* Reading the standard output of a container/script

* Taking the value from a specified file

Reading the standard output is okay for simple scripts, however since many programs will involve regular std output such as logging this may conflict and cause issues, hence creating a temp file to write the value is the easier route. Argo provides in their docs an example on how to do this:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: output-parameter-
spec:
  entrypoint: output-parameter
  templates:
  - name: output-parameter
    steps:
    - - name: generate-parameter
        template: whalesay
    - - name: consume-parameter
        template: print-message
        arguments:
          parameters:
          - name: message
            value: "{{steps.generate-parameter.outputs.parameters.hello-param}}"

  - name: whalesay
    container:
      image: docker/whalesay:latest
      command: [sh, -c]
      args: ["sleep 1; echo -n hello world > /tmp/hello_world.txt"]
    outputs:
      parameters:
      - name: hello-param
        valueFrom:
          default: "Foobar"   # Default value to use if retrieving valueFrom fails. If not provided workflow will fail instead
          path: /tmp/hello_world.txt

  - name: print-message
    inputs:
      parameters:
      - name: message
    container:
      image: docker/whalesay:latest
      command: [cowsay]
      args: ["{{inputs.parameters.message}}"]
```

We can see that the first step in this workflow writes the value “hello world” to a file /tmp/hello_world.txt , then argo grabs the value written to the file as a parameter called *hello-world*. Then we use

{{steps.generate-parameter.outputs.parameters.hello-param}}

to access that parameter in the next step, which uses whalesay to print out the parameter.

We can submit this workflow using the following command.

argo submit -n argo --watch output-parameter-workflow.yaml

This will give the following output in the terminal

![](https://cdn-images-1.medium.com/max/3200/1*U_VL3AlVeLLL1vE6DYBw9g.png)

We can view the logs for this workflow to verify the paramater was successfully passed between steps using:

argo logs -n argo @latest

![](https://cdn-images-1.medium.com/max/5120/1*ebc7yTtVAgWBpyhSGvSeNw.png)

### The withParam attribute.

We can use these output parameters to define the number of the following steps using the withParam attribute.

The withParam attribute takes a JSON list as input, and will run the steps in parallel for each value in the list.

We can use this to our advantage by creating this json list in the previous step, and then using it in the withParam attribute. A simple example of doing this might look as follows.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: loops-param-result-
spec:
  entrypoint: loop-param-result-example
  templates:
  - name: loop-param-result-example
    steps:
    - - name: generate
        template: gen-number-list
    - - name: sleep
        template: sleep-n-sec
        arguments:
          parameters:
          - name: seconds
            value: "{{item}}"
        withParam: "{{steps.generate.outputs.result}}"

  - name: gen-number-list
    script:
      image: python:alpine3.6
      command: [python]
      source: |
        import json
        import sys
        json.dump([i for i in range(20, 31)], sys.stdout)
  - name: sleep-n-sec
    inputs:
      parameters:
      - name: seconds
    container:
      image: alpine:latest
      command: [sh, -c]
      args: ["echo sleeping for {{inputs.parameters.seconds}} seconds; sleep {{inputs.parameters.seconds}}; echo done"]
```

In this example, in the first step we use a python script to dump a json array to standard output which looks as follows

[20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

Submitting this workflow using

argo submit -n argo --watch loops-param-result.yaml

Gives us the following output

![](https://cdn-images-1.medium.com/max/3572/1*li5T0lShSurJkOTHZcrI9A.png)

We can see that argo coordinates to run one of the “sleep” steps for each of the values spit out in the array, in the brackets we can also see the parameter that each step took.

### Applying this to our example

Coming back to our example, we mentioned that we want the number of data pullers to be generated to be dependent on the amount of data produced in the first step.

In my use case, I used the number of rows of data produced, divided by a number of rows to handle per db puller, to decide this value.

For example.

* If our data producer produces **1000** rows of data

* And our data pullers each handle **100** rows of data

* We want to spawn **10** steps of the data puller.

I also wanted this calculation to be de-coupled away from either of the steps, giving us more control over the operation.

My solution was as follows

1. Have my data generation stage write the number of rows written to a file. Use this file as the output parameter.

1. Add an “intermediate” step which uses this output value to produce a JSON List for with withParam attribute

1. Take this JSON list and use it in the withParam attribute in the data pulling step.

For the afore described intermediate step, I use a python script directly in the argo file. This step looks as follows

```yaml
- name: numb-sleep-steps
      inputs:
        parameters:
        - name: value
      script:
        image: python:alpine3.6
        command: [python]
        source: |
          import json
          import sys
          val_per_sleep = 100
          val = int({{inputs.parameters.value}}) / val_per_sleep
          json.dump([i for i in range(0, int(val))], sys.stdout)
```

We can see we take the input step as a parameter, calculates the number of the final step we want to produce, then creates a JSON list of that length.

We can access this in the steps stage using the result tag on outputs , without having to explicitly define it as an output parameter. This access looks as follows.

{{steps.numb-sleep-steps.outputs.result}}

Now we have produced this json list, we pass it to the final step as we showed in the previous example.

### Combined Solution

Now we combine these steps to produce a final Argo Workflow. This can be seen below.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow 
metadata:
  generateName: loops-param-result-
spec:
  entrypoint: loop-param-result-example
  templates:
  - name: loop-param-result-example
    steps:
    - - name: generate
        template: gen-number-list
    - - name: numb-sleep-steps
        template: numb-sleep-steps
        arguments:
          parameters:
          - name: value
            value: "{{steps.generate.outputs.parameters.value}}"
    - - name: sleep
        template: sleep-n-sec
        arguments:
          parameters:
          - name: seconds
            value: "{{item}}"
        withParam: "{{steps.numb-sleep-steps.outputs.result}}"

  - name: gen-number-list
    script:
      image: python:alpine3.6
      command: [python]
      # write a value to a file
      source: |
        f = open("value.txt", "w")
        f.write("1000")
        f.close()
    outputs:
      parameters:
      - name: value  # name of output parameter
        valueFrom:
          path: value.txt
          
  - name: numb-sleep-steps
    inputs:
      parameters:
      - name: value
    script:
      image: python:alpine3.6
      command: [python]
      source: |
        import json
        import sys
        val_per_sleep = 100
        val = int({{inputs.parameters.value}}) / val_per_sleep
        json.dump([i for i in range(0, int(val))], sys.stdout)
        
  - name: sleep-n-sec
    inputs:
      parameters:
      - name: seconds
    container:
      image: alpine:latest
      command: [sh, -c]
      args: ["echo sleeping for {{inputs.parameters.seconds}} seconds; sleep {{inputs.parameters.seconds}}; echo done"]
```

Note that the first job we run in the workflow is simply a python script which writes to a file. This could easily be a container which does a similar thing. Note that argo will read files within the local container space.

So to repeat, this workflow has the following three steps.

1. Perform some functionality, write an output number to a file, use this file as an output parameter

2. Take this output parameter value (a number), divide it by another number and produce a JSON list of length of the result. This is the output parameter.

3. Take this JSON list as input parameter, pass it to the withParam attribute for the step.

Run this workflow using the following command

argo submit -n argo --watch scaling-workflow.yaml

Note since we write the value “1000” to the file, then use val_per_sleep = 100 we expect 10 sleep-n-sec steps to be produced. Here is the terminal output.

![](https://cdn-images-1.medium.com/max/3628/1*Mn9QrVIoNWJ4NojmjvYDfw.png)

We can see we get the expected result.

If we change the value to val_per_sleep = 500 we would expect only 2 workflows to be produced. We can change this in the file and run it again. Giving the following output.

![](https://cdn-images-1.medium.com/max/3624/1*lCexh_47YcEJlI0REnp2Xw.png)

### Conclusion

So there we go, a way to dynamically scale a step in an Argo Workflow. I would think carefully before deciding if this is something you need, but if you do I think its a neat solution to the problem which takes advantage of configuration attributes available.